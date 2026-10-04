
import { NextResponse } from "next/server";
import { saveVoice, getVoices, deleteVoice, ClonedVoice } from "@/lib/db";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const voiceName = formData.get("voiceName") as string;
    const refText = formData.get("refText") as string;
    const consent = formData.get("consent") as string;
    const file = formData.get("file") as File;

    if (!voiceName || !file || !refText || consent !== "true") {
      return NextResponse.json({ error: "Missing fields or consent not granted." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const voiceId = "voice_" + crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.name) || ".wav";
    const fileName = `${voiceId}${ext}`;
    const savePath = path.join(process.cwd(), "voices", fileName);

    await writeFile(savePath, buffer);

    const newVoice: ClonedVoice = {
      id: voiceId,
      voice_name: voiceName,
      ref_text: refText,
      original_audio_path: savePath,
      created_at: new Date().toISOString()
    };

    await saveVoice(newVoice);

    return NextResponse.json({
      success: true,
      voice_id: voiceId,
      voice_name: voiceName
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const voices = await getVoices();
    return NextResponse.json(voices);
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const voices = await getVoices();
    const voice = voices.find(v => v.id === id);
    if (voice) {
       await unlink(voice.original_audio_path).catch(() => {});
       await deleteVoice(id);
    }
    return NextResponse.json({ success: true });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

