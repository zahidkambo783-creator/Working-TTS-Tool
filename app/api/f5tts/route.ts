
import { NextResponse } from "next/server";
import { client } from "@gradio/client";
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

    // Save temp
    tempPath = join(tmpdir(), `f5_ref_${Date.now()}.wav`);
    await writeFile(tempPath, buffer);

    console.log("Connecting to F5-TTS...");
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
    const genBuffer = await outRes.arrayBuffer();

    // Call python backend to trim the reference audio from the start
    const trimFormData = new FormData();
    trimFormData.append("ref_file", new Blob([new Uint8Array(buffer)], { type: "audio/wav" }));
    trimFormData.append("gen_file", new Blob([new Uint8Array(genBuffer)], { type: "audio/wav" }));
    
    const trimRes = await fetch("http://localhost:5000/api/trim-f5-audio", {
      method: "POST",
      body: trimFormData
    });
    
    if (!trimRes.ok) throw new Error("Failed to trim generated audio");
    const outBuffer = await trimRes.arrayBuffer();

    return new NextResponse(outBuffer, {
      headers: { "Content-Type": "audio/wav" },
    });
  } catch (error: any) {
    console.error("F5-TTS Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate via F5-TTS" }, { status: 500 });
  }
}

