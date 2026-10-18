
import { NextResponse } from "next/server";
import { client } from "@gradio/client";
import Replicate from "replicate";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { getVoices } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const text = formData.get("text") as string;
    const voiceId = formData.get("voice_id") as string;
    const hfToken = formData.get("hf_token") as string;
    const replicateToken = formData.get("replicate_token") as string;
    
    let buffer: Buffer;
    let refText: string;
    let fileType = "audio/wav";
    let tempPath = "";

    if (voiceId) {
       const voices = await getVoices();
       const voice = voices.find(v => v.id === voiceId);
       if (!voice) return NextResponse.json({ error: "Voice not found" }, { status: 404 });
       
       buffer = await readFile(voice.original_audio_path);
       refText = voice.ref_text;
       if (voice.original_audio_path.endsWith(".mp3")) fileType = "audio/mp3";
    } else {
       const refAudio = formData.get("refAudio") as File;
       refText = formData.get("refText") as string;
       if (!refAudio || !refText) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
       buffer = Buffer.from(await refAudio.arrayBuffer());
       fileType = refAudio.type || "audio/wav";
    }

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    // 1. Prioritize Local F5-TTS Engine (100% Free, Local GPU/CPU, No Quotas)
    try {
      console.log("Generating via Local F5-TTS Engine...");
      const localFormData = new FormData();
      localFormData.append("ref_audio", new Blob([new Uint8Array(buffer)], { type: fileType }), "ref.wav");
      localFormData.append("ref_text", refText || "");
      localFormData.append("gen_text", text);
      localFormData.append("speed", "1.0");

      const localRes = await fetch("http://localhost:5000/api/tts/f5-local", {
        method: "POST",
        body: localFormData,
      });

      if (localRes.ok) {
        console.log("Local F5-TTS generated successfully!");
        const outBuffer = await localRes.arrayBuffer();
        return new NextResponse(outBuffer, {
          headers: { "Content-Type": "audio/wav" },
        });
      }
      console.warn("Local F5-TTS returned status:", localRes.status);
    } catch (localErr: any) {
      console.warn("Local F5-TTS connection failed, checking fallbacks...", localErr?.message);
    }

    // 2. Cloud Fallback: If Replicate Token is provided, try Replicate
    if (replicateToken && replicateToken.trim()) {
      console.log("Generating via Replicate F5-TTS...");
      const replicate = new Replicate({ auth: replicateToken.trim() });
      const mime = fileType.includes("mp3") ? "audio/mp3" : "audio/wav";
      const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;

      const runWithRetry = async (model: `${string}/${string}` | `${string}/${string}:${string}`, retries = 2): Promise<any> => {
        try {
          return await replicate.run(model, {
            input: {
              gen_text: text,
              ref_audio: dataUri,
              ref_text: refText || "",
              remove_silence: true,
            }
          });
        } catch (err: any) {
          const isRateLimit = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("throttled");
          if (isRateLimit && retries > 0) {
            console.log(`Replicate throttled (429). Retrying in 5 seconds... (${retries} retries left)`);
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return await runWithRetry(model, retries - 1);
          }
          throw err;
        }
      };

      let output: any;
      try {
        output = await runWithRetry("x-lance/f5-tts:87faf6dd7a692dd82043f662e76369cab126a2cf1937e25a9d41e0b834fd230e");
      } catch (err: any) {
        console.warn("x-lance version failed, trying fallback nyxynyx version...", err?.message);
        output = await runWithRetry("nyxynyx/f5-tts:e0e48acce40cb39931ed5f1b04e21492bdcf2eb0a0f96842a5e537531e86389b");
      }

      console.log("Replicate output:", output);
      let outBuffer: ArrayBuffer;
      if (typeof output?.arrayBuffer === "function") {
        outBuffer = await output.arrayBuffer();
      } else {
        let audioUrl = typeof output === "string" ? output : (output?.url ? (typeof output.url === "function" ? output.url() : output.url) : String(output));
        if (Array.isArray(output) && output.length > 0) audioUrl = String(output[0]);
        const outRes = await fetch(audioUrl);
        if (!outRes.ok) throw new Error("Failed to download generated audio from Replicate");
        outBuffer = await outRes.arrayBuffer();
      }

      return new NextResponse(outBuffer, {
        headers: { "Content-Type": "audio/wav" },
      });
    }

    // 2. Fallback to Hugging Face Gradio Client
    console.log("Connecting to Hugging Face F5-TTS...");
    const appOptions: any = hfToken ? { hf_token: hfToken } : {};
    const app = await client("mrfakename/E2-F5-TTS", appOptions);
    
    const fileBlob = new Blob([new Uint8Array(buffer)], { type: fileType });
    const result = await app.predict("/predict", [
      fileBlob,
      refText,
      text,
      true, // remove silence
    ]);

    await unlink(tempPath).catch(() => {});

    const outData = (result as any).data[0] as any;
    if (!outData || !outData.url) throw new Error("Failed to get audio URL from F5-TTS");

    const outRes = await fetch(outData.url);
    if (!outRes.ok) throw new Error("Failed to download generated audio from Gradio");
    const outBuffer = await outRes.arrayBuffer();

    return new NextResponse(outBuffer, {
      headers: { "Content-Type": "audio/wav" },
    });
  } catch (error: any) {
    console.error("F5-TTS Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate via F5-TTS" }, { status: 500 });
  }
}

