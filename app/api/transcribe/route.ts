import { NextResponse } from "next/server";
import Replicate from "replicate";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const replicateToken = formData.get("replicate_token") as string;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Try Local Faster-Whisper Backend first
    try {
      const localFormData = new FormData();
      localFormData.append("file", file);

      const localRes = await fetch("http://localhost:5000/api/transcribe", {
        method: "POST",
        body: localFormData,
      });

      if (localRes.ok) {
        const data = await localRes.json();
        return NextResponse.json({
          text: data.text || "",
          language: data.language || "unknown",
          probability: data.language_probability ?? 1,
          engine: "local",
        });
      }
    } catch (localErr: any) {
      console.warn("Local Whisper transcription unavailable:", localErr?.message);
    }

    // Fallback: Replicate Cloud Whisper
    if (replicateToken && replicateToken.trim()) {
      try {
        console.log("Transcribing audio via Replicate Whisper Cloud...");
        const replicate = new Replicate({ auth: replicateToken.trim() });
        const buffer = Buffer.from(await file.arrayBuffer());
        const mime = file.type || "audio/wav";
        const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;

        const output: any = await replicate.run(
          "openai/whisper:4d50797290df26536e2ff41fe9a5e05ba450a2f41b45ac73c43c40e0f5441d3b",
          {
            input: {
              audio: dataUri,
              model: "large-v3",
              transcription: "plain text",
            },
          }
        );

        let transcribedText = "";
        if (typeof output === "string") {
          transcribedText = output;
        } else if (output?.transcription) {
          transcribedText = output.transcription;
        } else if (output?.text) {
          transcribedText = output.text;
        } else {
          transcribedText = JSON.stringify(output);
        }

        return NextResponse.json({
          text: transcribedText.trim(),
          language: "auto",
          engine: "replicate",
        });
      } catch (repErr: any) {
        console.error("Replicate Whisper failed:", repErr);
        throw new Error(repErr.message || "Cloud transcription failed.");
      }
    }

    throw new Error(
      "Local transcription backend is offline and no Replicate API token was provided. Please ensure Python backend is running on port 5000."
    );
  } catch (error: any) {
    console.error("Transcription API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to transcribe audio." },
      { status: 500 }
    );
  }
}
