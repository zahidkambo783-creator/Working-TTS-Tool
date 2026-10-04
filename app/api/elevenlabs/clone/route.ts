import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const key = req.headers.get("x-elevenlabs-key");
  if (!key) return NextResponse.json({ error: "No API key provided" }, { status: 401 });

  try {
    const formData = await req.formData();
    
    // Create new form data for ElevenLabs
    const elForm = new FormData();
    elForm.append("name", formData.get("name") as string);
    elForm.append("files", formData.get("audio") as Blob);
    elForm.append("description", "Cloned via ZK Voice Studio");

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: {
        "xi-api-key": key,
      },
      body: elForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || "Failed to clone voice in ElevenLabs");
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
