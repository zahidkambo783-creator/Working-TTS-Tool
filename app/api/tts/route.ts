import { NextRequest, NextResponse } from "next/server";
import { synthesize } from "@/lib/tts-engine";
import { Buffer } from "node:buffer";

// Split long text into manageable chunks at sentence boundaries
function splitTextIntoChunks(text: string, maxLength: number = 3000): string[] {
  const chunks: string[] = [];
  let currentChunk = "";
  
  // Basic split by paragraphs, then sentences
  const paragraphs = text.split('\n');
  
  for (const p of paragraphs) {
    const sentences = p.match(/[^.!?]+[.!?]*/g) || [p];
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxLength) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  
  // Fallback for massive un-punctuated strings
  return chunks.flatMap(c => {
     if (c.length <= maxLength) return [c];
     const sub = [];
     for (let i = 0; i < c.length; i += maxLength) sub.push(c.substring(i, i + maxLength));
     return sub;
  }).filter(c => c.trim().length > 0);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice, rate, pitch, volume } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    // 1. Try Python Backend with updated edge-tts 7.3.1 (handles Microsoft v2 DRM with 0% 403 errors!)
    try {
      const pythonRes = await fetch("http://localhost:5000/api/tts/edge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voice: voice || "en-US-AriaNeural",
          rate: rate || "+0%",
          pitch: pitch || "+0Hz",
          volume: volume || "+0%"
        }),
      });

      if (pythonRes.ok) {
        const audioBuffer = await pythonRes.arrayBuffer();
        const uint8 = new Uint8Array(audioBuffer);
        return new NextResponse(uint8, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Disposition": `attachment; filename="zk-voice-${Date.now()}.mp3"`,
            "Content-Length": uint8.byteLength.toString(),
            "Cache-Control": "no-store",
          },
        });
      }
    } catch (e) {
      console.warn("Python edge-tts unreachable, falling back to node...", e);
    }

    const chunks = splitTextIntoChunks(text.trim(), 3500);
    const audioBuffers: Buffer[] = [];

    // Synthesize chunks sequentially to prevent rate limiting
    for (const chunk of chunks) {
      const audioBuffer = await synthesize(chunk, {
        voice,
        rate,
        pitch,
        volume,
      });
      audioBuffers.push(audioBuffer);
    }

    // Combine all MP3 chunks into one continuous file
    const finalBuffer = Buffer.concat(audioBuffers);
    const uint8 = new Uint8Array(finalBuffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="zk-voice-${Date.now()}.mp3"`,
        "Content-Length": uint8.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[TTS Error]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to generate speech MP3. Please try again.",
      },
      { status: 500 }
    );
  }
}
