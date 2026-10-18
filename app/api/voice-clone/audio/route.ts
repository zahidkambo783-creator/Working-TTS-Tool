
import { NextResponse } from "next/server";
import { getVoices } from "@/lib/db";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Voice ID required" }, { status: 400 });

    const voices = await getVoices();
    const voice = voices.find(v => v.id === id);
    if (!voice) return NextResponse.json({ error: "Voice not found" }, { status: 404 });

    let audioPath = voice.original_audio_path;
    try {
      await readFile(/*turbopackIgnore: true*/ audioPath);
    } catch {
      audioPath = path.join(process.cwd(), "voices", path.basename(voice.original_audio_path));
    }

    const buffer = await readFile(/*turbopackIgnore: true*/ audioPath);
    const ext = path.extname(audioPath).toLowerCase();
    
    let mimeType = "audio/wav";
    if (ext === ".mp3") mimeType = "audio/mpeg";
    else if (ext === ".m4a") mimeType = "audio/mp4";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

