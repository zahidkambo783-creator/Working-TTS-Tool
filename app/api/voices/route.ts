import { NextResponse } from "next/server";
import { fetchVoices } from "@/lib/tts-engine";

// Cache voices for 1 hour
export const revalidate = 3600;

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const voices: any[] = await fetchVoices() as any[];

    // Sort: English first, then alphabetically by locale
    const sorted = voices.sort((a, b) => {
      const aEn = a.Locale?.startsWith("en") ? 0 : 1;
      const bEn = b.Locale?.startsWith("en") ? 0 : 1;
      if (aEn !== bEn) return aEn - bEn;
      return (a.Locale ?? "").localeCompare(b.Locale ?? "");
    });

    return NextResponse.json(sorted);
  } catch (err) {
    console.error("[Voices Error]", err);
    return NextResponse.json(
      { error: "Failed to load voices." },
      { status: 500 }
    );
  }
}
