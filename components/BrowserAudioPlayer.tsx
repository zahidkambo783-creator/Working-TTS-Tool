"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface BrowserAudioPlayerProps {
  audioUrl: string | null;
  voiceName: string;
  generating: boolean;
  speaking: boolean;
  onDownload: () => void;
  onStop: () => void;
}

function formatTime(seconds: number) {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function BrowserAudioPlayer({
  audioUrl,
  voiceName,
  generating,
  speaking,
  onDownload,
  onStop,
}: BrowserAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [audioUrl]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      // Stop browser TTS if playing
      onStop();
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing, audioUrl, onStop]);

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    setCurrentTime(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    setMuted(v === 0);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const next = !muted;
    setMuted(next);
    audioRef.current.muted = next;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-4"
      style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          Audio Player
        </h2>
        {audioUrl && (
          <span className="text-xs truncate max-w-[200px]" style={{ color: "var(--muted)" }}>
            {voiceName}
          </span>
        )}
      </div>

      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
          onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
          onEnded={() => setPlaying(false)}
          preload="metadata"
        />
      )}

      {/* Visual area */}
      <div
        className="relative flex items-center justify-center rounded-xl overflow-hidden"
        style={{ background: "var(--background)", height: "80px", border: "1px solid var(--card-border)" }}
      >
        {generating ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1 items-end h-8">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full animate-bounce"
                  style={{
                    background: "var(--accent)",
                    height: `${12 + ((i * 7) % 20)}px`,
                    animationDelay: `${i * 0.07}s`,
                    animationDuration: "0.8s",
                  }}
                />
              ))}
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Generating…</p>
          </div>
        ) : speaking ? (
          /* Animated speaking indicator */
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1 items-end h-8">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full"
                  style={{
                    background: "var(--success)",
                    height: `${10 + ((i * 11) % 24)}px`,
                    animation: `bounce 0.6s ${i * 0.05}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
            <p className="text-xs" style={{ color: "var(--success)" }}>🔊 Speaking via browser TTS…</p>
          </div>
        ) : !audioUrl ? (
          <div className="flex flex-col items-center gap-2 opacity-40">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
            </svg>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Click Generate to speak</p>
          </div>
        ) : (
          <div className="flex gap-0.5 items-end px-4 h-full pb-3 pt-3">
            {Array.from({ length: 40 }).map((_, i) => {
              const h = 8 + ((i * 13 + 7) % 40);
              const active = progress > 0 && i / 40 < progress / 100;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full"
                  style={{ height: `${h}px`, background: active ? "var(--accent)" : "var(--card-border)" }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Browser TTS info banner */}
      {!audioUrl && !generating && !speaking && (
        <div
          className="flex flex-col gap-2 px-3 py-3 rounded-xl text-xs"
          style={{ background: "rgba(124,111,247,0.08)", border: "1px solid rgba(124,111,247,0.2)" }}
        >
          <div className="flex items-start gap-2">
            <span>💡</span>
            <span style={{ color: "var(--muted)" }}>
              Audio plays instantly using your browser&apos;s built-in high-quality Microsoft voices.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span>⬇️</span>
            <span style={{ color: "var(--muted)" }}>
              An MP3 download will also be generated automatically using Google TTS as a fallback.
            </span>
          </div>
        </div>
      )}

      {/* Progress + time (for MP3 playback) */}
      {audioUrl && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono w-10 text-right" style={{ color: "var(--muted)" }}>
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={seek}
              className="flex-1"
              style={{
                background: `linear-gradient(to right, var(--accent) ${progress}%, var(--card-border) ${progress}%)`,
              }}
            />
            <span className="text-xs font-mono w-10" style={{ color: "var(--muted)" }}>
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              disabled={!audioUrl}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {playing ? (
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7-.75a.75.75 0 0 0-.75.75v13.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V5.25a.75.75 0 0 0-.75-.75h-1.5Z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            <button onClick={toggleMute} className="hover:opacity-70 cursor-pointer" style={{ color: "var(--muted)" }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                {muted || volume === 0 ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                )}
              </svg>
            </button>
            <input
              type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
              onChange={changeVolume} className="w-20"
              style={{ background: `linear-gradient(to right, var(--accent) ${(muted ? 0 : volume) * 100}%, var(--card-border) ${(muted ? 0 : volume) * 100}%)` }}
            />

            <button
              onClick={onDownload}
              disabled={!audioUrl}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80 cursor-pointer disabled:opacity-40"
              style={{ background: "var(--card-border)", color: "var(--foreground)" }}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download MP3
            </button>
          </div>
        </>
      )}

      {/* Download button when only browser TTS */}
      {!audioUrl && !generating && (
        <div className="flex justify-end">
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            MP3 download available after server synthesis
          </span>
        </div>
      )}
    </div>
  );
}
