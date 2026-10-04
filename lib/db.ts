
import fs from "fs/promises";
import path from "path";

const dbPath = path.join(process.cwd(), "voices.json");

export interface ClonedVoice {
  id: string;
  voice_name: string;
  original_audio_path: string;
  ref_text: string;
  created_at: string;
}

export async function getVoices(): Promise<ClonedVoice[]> {
  try {
    const data = await fs.readFile(dbPath, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export async function saveVoice(voice: ClonedVoice) {
  const voices = await getVoices();
  voices.push(voice);
  await fs.writeFile(dbPath, JSON.stringify(voices, null, 2));
}

export async function deleteVoice(id: string) {
  const voices = await getVoices();
  const filtered = voices.filter(v => v.id !== id);
  await fs.writeFile(dbPath, JSON.stringify(filtered, null, 2));
}

