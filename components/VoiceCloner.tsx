
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeStatus, setTranscribeStatus] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setAudioDuration(null);
    setTranscribeStatus(null);
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

  const handleAutoTranscribe = async () => {
    if (!file) {
      setError("Please select an audio file first.");
      return;
    }
    setError("");
    setTranscribeStatus(null);
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const repToken = typeof window !== "undefined" ? localStorage.getItem("replicate-token") : "";
      if (repToken) formData.append("replicate_token", repToken);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to transcribe audio.");

      if (data.text) {
        setRefText(data.text);
        const langInfo = data.language ? ` (${data.language.toUpperCase()})` : "";
        setTranscribeStatus(`✓ Auto-transcribed successfully${langInfo}`);
      } else {
        throw new Error("No speech detected in audio file.");
      }
    } catch (err: any) {
      setError(`Auto-transcribe error: ${err.message}`);
    } finally {
      setIsTranscribing(false);
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
              F5-TTS requires a 5–10s reference. Clips over 12s get cut off internally, which breaks alignment and causes whisper/noise.
            </p>
          </div>
        )}

        {audioDuration !== null && audioDuration <= 15 && (
          <div className="text-[11px] text-green-500 font-medium flex items-center gap-1 mt-0.5">
            <span>✓ Optimal clip length: {Math.round(audioDuration)}s. Ready for accurate cloning!</span>
          </div>
        )}

        {file && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border mt-1" style={{ background: "var(--elevated)", borderColor: "var(--card-border)" }}>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-semibold flex items-center gap-1.5 truncate">
                🎵 {file.name}
              </span>
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                {audioDuration ? `${Math.round(audioDuration)}s audio` : "Audio uploaded"} • Click to extract exact words
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoTranscribe}
              disabled={isTranscribing}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-sm shrink-0"
              style={{ background: "var(--accent)", color: "#09090D" }}
              title="Click to automatically listen to the audio and fill the exact transcript with Whisper AI"
            >
              {isTranscribing ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                  <span>Transcribing with AI...</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
                  <span>✨ Auto Transcribe Audio</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Reference Transcript</label>
          {transcribeStatus && (
            <span className="text-[10px] text-emerald-400 font-semibold">{transcribeStatus}</span>
          )}
        </div>
        <textarea 
          rows={3}
          value={refText}
          onChange={(e) => setRefText(e.target.value)}
          placeholder="Type or click 'Auto Transcribe Audio' above to automatically fill the exact 1-to-1 words spoken in this audio..."
          className="bg-transparent border rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none"
          style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
        />
        <p className="text-[10px]" style={{ color: "var(--muted)" }}>
          Must match what is spoken in the audio clip. Supports any language (English, Hindi, Urdu, Spanish, etc.).
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

