"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface AudioPlayerProps {
  audioUrl: string | null;
  voiceName: string;
  generating: boolean;
  onDownload: () => void;
  onSendToSilenceRemover?: () => void;
}

function formatTime(seconds: number) {
  if (!isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({
  audioUrl,
  voiceName,
  generating,
  onDownload,
  onSendToSilenceRemover,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // Reset player when a new audio URL is loaded
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [audioUrl]);

    const [genProgress, setGenProgress] = useState(0);

  // Simulated progress bar during generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (generating) {
      setGenProgress(0);
      let p = 0;
      interval = setInterval(() => {
        p += (90 - p) * 0.1; // Smoothly approach 90%
        setGenProgress(Math.floor(p));
      }, 100);
    } else {
      if (genProgress > 0) {
        setGenProgress(100);
        setTimeout(() => setGenProgress(0), 500); // Reset after a small delay
      }
    }
    return () => clearInterval(interval);
  }, [generating]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }, [playing, audioUrl]);

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };
  const handleLoaded = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };
  const handleEnded = () => setPlaying(false);

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    setCurrentTime(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    setMuted(v === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const newMuted = !muted;
    setMuted(newMuted);
    audioRef.current.muted = newMuted;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="rounded-2xl border flex flex-col overflow-hidden shadow-2xl"
      style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}
    >
      <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--card-border)", background: "rgba(0,0,0,0.2)" }}>
        <div className="flex items-center gap-4">
           <div className="w-10 h-10 rounded-xl flex items-center justify-center border" style={{ background: "var(--background)", borderColor: "var(--card-border)", color: "var(--accent)" }}>
             <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v9.28a4.39 4.39 0 0 0-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/></svg>
           </div>
           <div className="flex flex-col">
              <h2 className="font-bold text-base tracking-tight text-white">Audio Output</h2>
              {audioUrl ? (
                <span className="text-xs font-medium truncate max-w-[220px]" style={{ color: "var(--accent-secondary)" }}>
                  {voiceName}
                </span>
              ) : (
                <span className="text-xs" style={{ color: "var(--muted)" }}>Awaiting synthesis</span>
              )}
           </div>
        </div>
        <div className="flex items-center gap-2">
          {onSendToSilenceRemover && (
            <button
              onClick={onSendToSilenceRemover}
              disabled={!audioUrl || generating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 border hover:bg-[var(--elevated)]"
              style={{ borderColor: "var(--card-border)", color: "var(--foreground)", background: "var(--background)" }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Remove Silence
            </button>
          )}
          <button
            onClick={onDownload}
            disabled={!audioUrl || generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 border hover:bg-[var(--elevated)]"
            style={{ borderColor: "var(--card-border)", color: "var(--foreground)", background: "var(--background)" }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export MP3
          </button>
        </div>
      </div>

      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoaded}
          onEnded={handleEnded}
          preload="metadata"
        />
      )}

      {/* Waveform Area */}
      <div
        className="relative flex flex-col items-center justify-center p-6 border-b"
        style={{
          background: "radial-gradient(circle at center, rgba(139,114,255,0.05) 0%, var(--background) 100%)",
          borderColor: "var(--card-border)",
          minHeight: "180px",
        }}
      >
        {generating || genProgress > 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 w-full max-w-md z-10">
            <div className="w-16 h-16 relative flex items-center justify-center">
               <div className="absolute inset-0 rounded-full border-t-2 border-[var(--accent)] animate-spin"></div>
               <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
               </svg>
            </div>
            <div className="w-full flex flex-col gap-2">
              <div className="flex justify-between w-full text-xs font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                <span>Synthesizing</span>
                <span>{genProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden bg-black/40 border border-white/5">
                <div
                  className="h-full rounded-full transition-all ease-out"
                  style={{
                    width: `${genProgress}%`,
                    background: "var(--accent)",
                    boxShadow: "0 0 12px var(--accent-glow)",
                    transitionDuration: generating ? "100ms" : "300ms"
                  }}
                />
              </div>
            </div>
          </div>
        ) : !audioUrl ? (
          <div className="flex flex-col items-center gap-5 opacity-70 my-8 z-10">
            <div className="w-20 h-20 rounded-full flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full border border-[var(--accent)] animate-ping opacity-20"></div>
              <div className="absolute inset-0 rounded-full bg-[var(--accent)] opacity-[0.08] blur-xl"></div>
              <div className="w-14 h-14 rounded-full bg-black/40 border border-white/5 flex items-center justify-center relative z-10 backdrop-blur-sm">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <p className="text-sm font-bold tracking-wide text-white">Ready for Synthesis</p>
              <p className="text-xs max-w-[220px] leading-relaxed" style={{ color: "var(--muted)" }}>Enter your script and click generate to create studio-quality audio</p>
            </div>
          </div>
        ) : (
          /* Visual bars when audio is ready */
          <div className="flex gap-[3px] items-end px-2 h-[100px] w-full max-w-2xl mx-auto z-10">
            {Array.from({ length: 70 }).map((_, i) => {
              const h = 15 + ((i * 17 + 13) % 70);
              const active = progress > 0 && i / 70 < progress / 100;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-sm transition-all duration-75"
                  style={{
                    height: `${h}%`,
                    background: active ? "var(--accent)" : "var(--muted)",
                    opacity: active ? 1 : 0.3,
                    boxShadow: active ? "0 0 8px var(--accent-glow)" : "none"
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Playback Controls */}
      <div className="flex flex-col px-6 py-5 gap-4" style={{ background: "var(--surface)" }}>
        {/* Progress scrub */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono font-medium w-10 text-right" style={{ color: "var(--accent-secondary)" }}>
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative flex items-center group cursor-pointer h-4">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={seek}
              disabled={!audioUrl || generating}
              className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/40 border border-white/5 relative">
               <div 
                 className="absolute top-0 left-0 h-full bg-[var(--accent)] transition-all ease-linear"
                 style={{ width: `${progress}%`, boxShadow: "0 0 10px var(--accent-glow)" }}
               />
            </div>
            {/* Custom thumb */}
            {audioUrl && !generating && (
              <div 
                className="absolute w-3 h-3 rounded-full bg-white shadow-md pointer-events-none transition-transform group-hover:scale-125"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            )}
          </div>
          <span className="text-xs font-mono font-medium w-10" style={{ color: "var(--muted)" }}>
            {formatTime(duration)}
          </span>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-6">
            <button
              onClick={toggle}
              disabled={!audioUrl || generating}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 hover:scale-105 active:scale-95 shadow-xl"
              style={{ 
                background: "var(--accent)", 
                color: "#09090D",
                boxShadow: audioUrl && !generating ? "0 4px 20px var(--accent-glow)" : "none"
              }}
            >
              {playing ? (
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24" className="ml-1.5"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            <div className="flex items-center gap-3">
              <button onClick={toggleMute} className="transition-all hover:text-white cursor-pointer" style={{ color: "var(--muted)" }}>
                {muted || volume === 0 ? (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
                ) : (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
                )}
              </button>
              <div className="relative flex items-center group w-20 h-4 cursor-pointer">
                <input
                  type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={changeVolume}
                  className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                />
                <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/40 border border-white/5 relative">
                  <div 
                    className="absolute top-0 left-0 h-full bg-[var(--muted)] transition-all group-hover:bg-[var(--accent)]"
                    style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--muted)" }}>
            <span className="px-2.5 py-1.5 rounded-md bg-black/20 border border-white/5">1.0x</span>
            <span className="px-2.5 py-1.5 rounded-md bg-black/20 border border-white/5">MP3</span>
          </div>
        </div>
      </div>
    </div>
  );
}
