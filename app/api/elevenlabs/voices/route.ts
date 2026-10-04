import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const key = req.headers.get("x-elevenlabs-key");
  
  const headers: Record<string, string> = {};
  if (key) {
    headers["xi-api-key"] = key;
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || "Failed to fetch ElevenLabs voices");
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
