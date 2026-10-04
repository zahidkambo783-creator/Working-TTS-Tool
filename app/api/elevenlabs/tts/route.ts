import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const key = req.headers.get("x-elevenlabs-key");
  if (!key) return NextResponse.json({ error: "No API key provided" }, { status: 401 });

  try {
    const { text, voiceId } = await req.json();
    if (!text || !voiceId) {
      return NextResponse.json({ error: "Missing text or voiceId" }, { status: 400 });
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err || "Failed to generate audio via ElevenLabs" }, { status: res.status });
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
