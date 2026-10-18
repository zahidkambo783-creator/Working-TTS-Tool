
"use client";

import { useState, useRef } from "react";

interface VoiceClonerProps {
  onSuccess: (voiceId: string, voiceName: string) => void;
}

export default function VoiceCloner({ onSuccess }: VoiceClonerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [refText, setRefText] = useState("");
  const [consent, setConsent] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setAudioDuration(null);
    if (selected) {
      try {
        const audioObj = new Audio(URL.createObjectURL(selected));
        audioObj.onloadedmetadata = () => {
          if (!isNaN(audioObj.duration) && isFinite(audioObj.duration)) {
            setAudioDuration(audioObj.duration);
          }
        };
      } catch (err) {
        console.warn("Could not read audio duration", err);
      }
    }
  };

  const handleClone = async () => {
    setError("");
    if (!voiceName.trim()) { setError("Please enter a Voice Name."); return; }
    if (!file) { setError("Please upload a voice sample."); return; }
    if (!refText.trim()) { setError("Please enter the transcript of the audio."); return; }
    if (!consent) { setError("You must confirm you have permission to clone this voice."); return; }

    setIsCloning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("voiceName", voiceName);
      formData.append("refText", refText);
      formData.append("consent", consent ? "true" : "false");

      const res = await fetch("/api/voice-clone", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Voice cloning failed.");

      alert("Voice cloned successfully.");
      onSuccess(data.voice_id, data.voice_name);
      
      // Reset
      setVoiceName("");
      setRefText("");
      setFile(null);
      setAudioDuration(null);
      setConsent(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6 border rounded-xl" style={{ borderColor: "var(--card-border)", background: "var(--surface)" }}>
      <div>
        <h3 className="font-bold text-lg">Clone My Voice</h3>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Create an ultra-realistic zero-shot voice clone using local F5-TTS.
        </p>
      </div>

      {/* Pro-Tips Box */}
      <div className="p-3.5 rounded-xl border text-xs flex flex-col gap-1.5" style={{ borderColor: "var(--card-border)", background: "var(--elevated)" }}>
        <span className="font-bold text-[var(--accent)] flex items-center gap-1.5">
          💡 Golden Rules for Voice Cloning Success:
        </span>
        <ul className="list-disc list-inside space-y-1 text-[11px]" style={{ color: "var(--muted)" }}>
          <li><strong>Short Audio Clip:</strong> Upload <strong>5 to 10 seconds</strong> of clean speech (no background music).</li>
          <li><strong>Exact Match:</strong> The Reference Transcript must match <strong>ONLY that short clip word-for-word</strong>.</li>
          <li><strong>Any Language:</strong> Works with English, Hindi, Spanish, Urdu, etc. (Non-Latin scripts are automatically transliterated for crystal-clear phonetics).</li>
        </ul>
      </div>
      
      {error && <div className="p-3 text-red-500 text-sm bg-red-500/10 rounded-lg">{error}</div>}

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Voice Name</label>
        <input 
          type="text" 
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          placeholder="e.g. Rahul Hindi Voice / Sofia Spanish"
          className="bg-transparent border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors"
          style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Upload Voice Sample (5–10 Seconds Recommended)</label>
        <input 
          type="file" 
          accept="audio/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[var(--elevated)] file:text-[var(--foreground)] hover:file:bg-opacity-80 cursor-pointer"
        />

        {audioDuration !== null && audioDuration > 15 && (
          <div className="p-3 rounded-lg border text-xs flex flex-col gap-1 mt-1" style={{ borderColor: "#f59e0b", background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}>
            <span className="font-bold">⚠️ Long Audio Detected: {Math.round(audioDuration)} seconds</span>
            <p className="text-[11px] opacity-90">
              F5-TTS requires a 5–10s reference. Clips over 12s get cut off internally, which breaks the alignment with long transcripts and causes whisper/noise. Please make sure your Reference Transcript below contains <strong>ONLY the first sentence</strong> spoken in the audio.
            </p>
          </div>
        )}

        {audioDuration !== null && audioDuration <= 15 && (
          <div className="text-[11px] text-green-500 font-medium flex items-center gap-1 mt-0.5">
            <span>✓ Optimal clip length: {Math.round(audioDuration)}s. Ready for accurate cloning!</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Reference Transcript</label>
        <textarea 
          rows={3}
          value={refText}
          onChange={(e) => setRefText(e.target.value)}
          placeholder="Type the exact 1-to-1 words spoken in this audio clip..."
          className="bg-transparent border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none"
          style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
        />
        <p className="text-[10px]" style={{ color: "var(--muted)" }}>
          Type exactly what is spoken in the audio sample in your language (English, Hindi, Spanish, Urdu, etc.).
        </p>
      </div>

      <div className="flex items-start gap-2 mt-2">
        <input 
          type="checkbox" 
          id="consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
        />
        <label htmlFor="consent" className="text-xs text-[var(--muted)] cursor-pointer">
          I confirm that I have the right and permission to use and clone this voice.
        </label>
      </div>

      <button 
        onClick={handleClone}
        disabled={isCloning}
        className="w-full mt-4 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        style={{ background: "var(--accent)", color: "white" }}
      >
        {isCloning ? "Processing..." : "Create Voice Clone"}
      </button>
    </div>
  );
}

