
import { NextResponse } from "next/server";
import { client } from "@gradio/client";
import Replicate from "replicate";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { getVoices } from "@/lib/db";

import anyAscii from "any-ascii";

function sanitizeText(str: string): string {
  if (!str) return "";
  const hasNonLatin = Array.from(str).some((c) => {
    const code = c.charCodeAt(0);
    return code > 0x024f && code < 0x2e80;
  });
  return hasNonLatin ? anyAscii(str) : str;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const text = formData.get("text") as string;
    const voiceId = formData.get("voice_id") as string;
    const engine = (formData.get("engine") as string) || "local"; // "local" | "replicate"
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

    // Sanitize non-Latin text (Devanagari, Urdu, etc.) for F5-TTS phonetic pronunciation
    const safeText = sanitizeText(text);
    const safeRefText = sanitizeText(refText);

    // MODE 1: USER CHOSE REPLICATE CLOUD GPU
    if (engine === "replicate") {
      if (!replicateToken || !replicateToken.trim()) {
        return NextResponse.json({
          error: "Replicate API token is required for Cloud GPU mode. Please add your token in Settings or switch to Local PC Engine."
        }, { status: 400 });
      }

      console.log("Generating via Replicate F5-TTS Cloud GPU...");
      const replicate = new Replicate({ auth: replicateToken.trim() });
      const mime = fileType.includes("mp3") ? "audio/mp3" : "audio/wav";
      const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;

      const runWithRetry = async (model: `${string}/${string}` | `${string}/${string}:${string}`, retries = 2): Promise<any> => {
        try {
          return await replicate.run(model, {
            input: {
              gen_text: safeText,
              ref_audio: dataUri,
              ref_text: safeRefText || "",
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

      console.log("Replicate output received!");
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

    // MODE 2: USER CHOSE LOCAL PC ENGINE (DEFAULT)
    try {
      console.log("Generating via Local F5-TTS Engine on PC...");
      const localFormData = new FormData();
      localFormData.append("ref_audio", new Blob([new Uint8Array(buffer)], { type: fileType }), "ref.wav");
      localFormData.append("ref_text", safeRefText || "");
      localFormData.append("gen_text", safeText);
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
      } else {
        const errData = await localRes.json().catch(() => ({}));
        console.warn("Local F5-TTS returned error:", localRes.status, errData);
        throw new Error(errData.error || `Local F5-TTS returned status ${localRes.status}`);
      }
    } catch (localErr: any) {
      console.warn("Local F5-TTS failed:", localErr?.message);
      
      // Auto-fallback to Replicate if token is present
      if (replicateToken && replicateToken.trim()) {
        console.log("Local PC engine unavailable, falling back to Replicate...");
        const replicate = new Replicate({ auth: replicateToken.trim() });
        const mime = fileType.includes("mp3") ? "audio/mp3" : "audio/wav";
        const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;
        const output: any = await replicate.run("x-lance/f5-tts:87faf6dd7a692dd82043f662e76369cab126a2cf1937e25a9d41e0b834fd230e", {
          input: {
            gen_text: safeText,
            ref_audio: dataUri,
            ref_text: safeRefText || "",
            remove_silence: true,
          }
        });
        let audioUrl = typeof output === "string" ? output : (output?.url ? (typeof output.url === "function" ? output.url() : output.url) : String(output));
        if (Array.isArray(output) && output.length > 0) audioUrl = String(output[0]);
        const outRes = await fetch(audioUrl);
        const outBuffer = await outRes.arrayBuffer();
        return new NextResponse(outBuffer, { headers: { "Content-Type": "audio/wav" } });
      }

      throw new Error(`Local PC Engine error: ${localErr?.message || "Make sure Python backend is running on port 5000."}`);
    }
  } catch (error: any) {
    console.error("F5-TTS Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate via F5-TTS" }, { status: 500 });
  }
}

