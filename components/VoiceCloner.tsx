
"use client";

import { useState, useRef } from "react";

interface VoiceClonerProps {
  onSuccess: (voiceId: string, voiceName: string) => void;
}

export default function VoiceCloner({ onSuccess }: VoiceClonerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [refText, setRefText] = useState("");
  const [consent, setConsent] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <h3 className="font-bold">Clone My Voice</h3>
      
      {error && <div className="p-3 text-red-500 text-sm bg-red-500/10 rounded-lg">{error}</div>}

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Voice Name</label>
        <input 
          type="text" 
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          placeholder="e.g. My Cloned Voice"
          className="bg-transparent border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors"
          style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Upload Voice Sample</label>
        <p className="text-[10px] text-[var(--muted)]">Supported formats: MP3, WAV. Max size: 10MB.<br/>For best results, upload a clean voice recording with minimal background noise.</p>
        <input 
          type="file" 
          accept="audio/*"
          ref={fileInputRef}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[var(--elevated)] file:text-[var(--foreground)] hover:file:bg-opacity-80 cursor-pointer"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Reference Transcript</label>
        <input 
          type="text" 
          value={refText}
          onChange={(e) => setRefText(e.target.value)}
          placeholder="Exact text spoken in the audio"
          className="bg-transparent border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors"
          style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
        />
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
        className="w-full mt-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 transition-colors"
        style={{ background: "var(--accent)", color: "white" }}
      >
        {isCloning ? "Processing..." : "Create Voice Clone"}
      </button>
    </div>
  );
}

