import React, { useState, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface ProcessingStats {
  originalDuration: number;
  optimizedDuration: number;
}

export default function SilenceRemover({ initialAudioUrl }: { initialAudioUrl?: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(initialAudioUrl || null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  
  const [minSilenceLen, setMinSilenceLen] = useState(250);
  const [silenceThresh, setSilenceThresh] = useState(-40);
  const [keepSilence, setKeepSilence] = useState(150);
  
  const [status, setStatus] = useState<"idle" | "processing" | "done">("idle");
  const [processStage, setProcessStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const [stats, setStats] = useState<ProcessingStats | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const originalWaveRef = useRef<HTMLDivElement>(null);
  const optimizedWaveRef = useRef<HTMLDivElement>(null);
  
  const originalWsRef = useRef<WaveSurfer | null>(null);
  const optimizedWsRef = useRef<WaveSurfer | null>(null);
  
  const [origPlaying, setOrigPlaying] = useState(false);
  const [optPlaying, setOptPlaying] = useState(false);

  useEffect(() => {
    if (initialAudioUrl) {
      setInputUrl(initialAudioUrl);
      setFile(null);
    }
  }, [initialAudioUrl]);

  // Clean up wavesurfers
  useEffect(() => {
    return () => {
      originalWsRef.current?.destroy();
      optimizedWsRef.current?.destroy();
    };
  }, []);

  // Initialize wavesurfers when URLs are available
  useEffect(() => {
    if (status === "done" && inputUrl && originalWaveRef.current) {
      if (originalWsRef.current) originalWsRef.current.destroy();
      originalWsRef.current = WaveSurfer.create({
        container: originalWaveRef.current,
        waveColor: 'rgba(255, 255, 255, 0.2)',
        progressColor: 'var(--accent)',
        height: 60,
        barWidth: 2,
        barRadius: 2,
        cursorWidth: 0,
        url: inputUrl,
      });
      originalWsRef.current.on('play', () => setOrigPlaying(true));
      originalWsRef.current.on('pause', () => setOrigPlaying(false));
      originalWsRef.current.on('finish', () => setOrigPlaying(false));
      
      originalWsRef.current.on('ready', () => {
         const dur = originalWsRef.current?.getDuration() || 0;
         setStats(prev => ({ ...prev, originalDuration: dur, optimizedDuration: prev?.optimizedDuration || 0 }));
      });
    }
  }, [inputUrl, status]);

  useEffect(() => {
    if (status === "done" && outputUrl && optimizedWaveRef.current) {
      if (optimizedWsRef.current) optimizedWsRef.current.destroy();
      optimizedWsRef.current = WaveSurfer.create({
        container: optimizedWaveRef.current,
        waveColor: 'rgba(255, 255, 255, 0.2)',
        progressColor: '#8B72FF',
        height: 60,
        barWidth: 2,
        barRadius: 2,
        cursorWidth: 0,
        url: outputUrl,
      });
      optimizedWsRef.current.on('play', () => setOptPlaying(true));
      optimizedWsRef.current.on('pause', () => setOptPlaying(false));
      optimizedWsRef.current.on('finish', () => setOptPlaying(false));
      
      optimizedWsRef.current.on('ready', () => {
         const dur = optimizedWsRef.current?.getDuration() || 0;
         setStats(prev => ({ ...prev, optimizedDuration: dur, originalDuration: prev?.originalDuration || 0 }));
      });
    }
  }, [outputUrl, status]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setInputUrl(url);
      setOutputUrl(null);
      setError(null);
      setStatus("idle");
      setStats(null);
    }
  };

  const handleProcess = async () => {
    if (!file && !inputUrl) return;
    
    setStatus("processing");
    setError(null);
    setOutputUrl(null);
    
    try {
      setProcessStage("Reading audio...");
      let fileToUpload = file;
      if (!fileToUpload && inputUrl) {
        const res = await fetch(inputUrl);
        const blob = await res.blob();
        fileToUpload = new File([blob], "input_audio.wav", { type: blob.type || 'audio/wav' });
      }
      
      if (!fileToUpload) throw new Error("No file to process");

      setProcessStage("Analyzing speech and protecting words...");
      
      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("min_silence_len", minSilenceLen.toString());
      formData.append("silence_thresh", silenceThresh.toString());
      formData.append("keep_silence", keepSilence.toString());

      const res = await fetch("http://localhost:5000/api/remove-silence", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to process audio");
      }

      setProcessStage("Generating optimized high-quality MP3...");
      const outBlob = await res.blob();
      const outUrl = URL.createObjectURL(outBlob);
      setOutputUrl(outUrl);
      setStatus("done");
      
    } catch (err: any) {
      setError(err.message);
      setStatus("idle");
    }
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.type.includes('audio') || droppedFile.name.match(/\.(mp3|wav|m4a)$/i))) {
      setFile(droppedFile);
      setInputUrl(URL.createObjectURL(droppedFile));
      setStatus("idle");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ":" + s.toString().padStart(2, '0');
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto text-white">
      {/* Hero Section */}
      <div className="text-center mb-10 pt-4">
        <h1 className="text-4xl font-black tracking-tight mb-3">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Audio Silence Remover</span>
        </h1>
        <h2 className="text-xl font-medium mb-4">Remove Silence. Keep Every Word.</h2>
        <p className="max-w-2xl mx-auto text-sm" style={{ color: "var(--muted)" }}>
          Upload your voiceover and let Audio Silence Remover intelligently remove unnecessary pauses while preserving natural speech and audio quality.
        </p>
      </div>

      {status === "idle" && (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <input type="file" accept=".mp3,.wav,.m4a,audio/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="w-full h-64 border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-white/5 hover:border-[var(--accent)] relative overflow-hidden group"
                style={{ borderColor: inputUrl ? "var(--accent)" : "var(--card-border)", background: "var(--surface)" }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--accent)] opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none" />
                
                {inputUrl ? (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full mx-auto mb-4 bg-[var(--accent)] flex items-center justify-center text-black">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    </div>
                    <p className="font-bold text-lg mb-1">Audio Ready for Processing</p>
                    <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>{file ? file.name : "Generated Voiceover"}</p>
                    <audio src={inputUrl} controls className="h-10 mx-auto" />
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full mx-auto mb-6 bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--muted)" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18v-7m0 0l-3 3m3-3l3 3" /></svg>
                    </div>
                    <h3 className="text-xl font-bold mb-2">Upload Your Voiceover</h3>
                    <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>Drag and drop your audio here or click to browse</p>
                    <div className="flex justify-center gap-3 text-xs font-semibold tracking-wide" style={{ color: "var(--muted)" }}>
                      <span className="px-3 py-1 rounded bg-black/40 border border-white/10">MP3</span>
                      <span className="px-3 py-1 rounded bg-black/40 border border-white/10">WAV</span>
                      <span className="px-3 py-1 rounded bg-black/40 border border-white/10">M4A</span>
                    </div>
                  </div>
                )}
              </div>
              
              {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium flex items-center gap-3">
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  {error}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="p-6 rounded-3xl border bg-[var(--surface)] h-full" style={{ borderColor: "var(--card-border)" }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-lg">Processing Settings</h3>
                  <button 
                    onClick={() => {
                      setSilenceThresh(-40);
                      setMinSilenceLen(250);
                      setKeepSilence(150);
                    }}
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                    style={{ color: "var(--muted)" }}
                  >
                    Reset Defaults
                  </button>
                </div>
                <p className="text-xs mb-6" style={{ color: "var(--muted)" }}>Tweak these to get the perfect balance between speed and natural speech.</p>
                
                <div className="flex flex-col gap-8">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <label className="text-sm font-bold block mb-1">Silence Volume</label>
                        <p className="text-[11px]" style={{ color: "var(--muted)" }}>How quiet is considered "silence"?</p>
                      </div>
                      <span className="text-sm font-mono font-bold bg-white/5 px-2 py-1 rounded text-[var(--accent)]">{silenceThresh} dB</span>
                    </div>
                    <div className="relative pt-2 pb-2">
                      <input type="range" min="-60" max="-10" step="1" value={silenceThresh} onChange={(e) => setSilenceThresh(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-[var(--accent)] hover:bg-white/20 transition-colors" />
                    </div>
                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider mt-1" style={{ color: "var(--muted)" }}>
                      <span>Very Quiet (-60)</span>
                      <span>Loud (-10)</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <label className="text-sm font-bold block mb-1">Pause Length</label>
                        <p className="text-[11px]" style={{ color: "var(--muted)" }}>How long must a pause be to get cut?</p>
                      </div>
                      <span className="text-sm font-mono font-bold bg-white/5 px-2 py-1 rounded text-[var(--accent)]">{minSilenceLen} ms</span>
                    </div>
                    <div className="relative pt-2 pb-2">
                      <input type="range" min="100" max="1500" step="50" value={minSilenceLen} onChange={(e) => setMinSilenceLen(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-[var(--accent)] hover:bg-white/20 transition-colors" />
                    </div>
                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider mt-1" style={{ color: "var(--muted)" }}>
                      <span>Aggressive (100ms)</span>
                      <span>Relaxed (1.5s)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <label className="text-sm font-bold block mb-1">Natural Gap Buffer</label>
                        <p className="text-[11px]" style={{ color: "var(--muted)" }}>How much silence to leave around cuts?</p>
                      </div>
                      <span className="text-sm font-mono font-bold bg-white/5 px-2 py-1 rounded text-[var(--accent)]">{keepSilence} ms</span>
                    </div>
                    <div className="relative pt-2 pb-2">
                      <input type="range" min="0" max="500" step="50" value={keepSilence} onChange={(e) => setKeepSilence(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-[var(--accent)] hover:bg-white/20 transition-colors" />
                    </div>
                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider mt-1" style={{ color: "var(--muted)" }}>
                      <span>Robotic / Tight (0ms)</span>
                      <span>Natural (500ms)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center mt-2">
            <button 
              onClick={handleProcess}
              disabled={!inputUrl}
              className="px-10 py-4 rounded-xl text-lg font-black tracking-wide uppercase transition-all shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
              style={{ background: "var(--accent)", color: "#09090D", boxShadow: inputUrl ? "0 10px 40px -10px var(--accent)" : "none" }}
            >
              Analyze & Optimize
            </button>
          </div>
        </div>
      )}

      {status === "processing" && (
        <div className="flex flex-col items-center justify-center h-64 animate-in zoom-in-95 duration-500">
          <div className="relative w-32 h-32 flex items-center justify-center mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-[var(--accent)] opacity-20" />
            <div className="absolute inset-0 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin" />
            <div className="absolute inset-0 rounded-full bg-[var(--accent)] opacity-10 animate-pulse" />
            <svg className="w-10 h-10 animate-pulse text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          </div>
          <h3 className="text-2xl font-bold mb-2">Analyzing Audio...</h3>
          <p className="text-[var(--accent)] font-medium animate-pulse">{processStage}</p>
        </div>
      )}

      {status === "done" && (
        <div className="flex flex-col gap-8 animate-in fade-in duration-700">
          
          {/* Waveform Comparisons */}
          <div className="grid grid-cols-1 gap-6">
            <div className="p-6 rounded-3xl border bg-[var(--surface)] relative overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-lg font-bold">Original Audio</h3>
                 <button onClick={() => originalWsRef.current?.playPause()} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                   {origPlaying ? (
                     <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                   ) : (
                     <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" className="ml-1"><path d="M8 5v14l11-7z"/></svg>
                   )}
                 </button>
               </div>
               <div ref={originalWaveRef} className="w-full h-[60px]" />
            </div>

            <div className="p-6 rounded-3xl border relative overflow-hidden shadow-2xl" style={{ borderColor: "var(--accent)", background: "rgba(139, 114, 255, 0.03)" }}>
               <div className="absolute top-0 right-0 px-4 py-1 bg-[var(--accent)] text-[#09090D] text-[10px] font-black uppercase tracking-widest rounded-bl-xl">Silence Removed</div>
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-lg font-bold text-[var(--accent)]">Optimized Audio</h3>
                 <button onClick={() => optimizedWsRef.current?.playPause()} className="w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 transition-all text-[#09090D]" style={{ background: "var(--accent)", boxShadow: "0 4px 15px var(--accent-glow)" }}>
                   {optPlaying ? (
                     <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                   ) : (
                     <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" className="ml-1"><path d="M8 5v14l11-7z"/></svg>
                   )}
                 </button>
               </div>
               <div ref={optimizedWaveRef} className="w-full h-[60px]" />
            </div>
          </div>

          {/* Stats & Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 rounded-3xl border bg-[var(--surface)] flex flex-col justify-center" style={{ borderColor: "var(--card-border)" }}>
              <h3 className="text-sm font-bold text-[var(--muted)] mb-6 uppercase tracking-widest">Processing Summary</h3>
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <p className="text-xs text-[var(--muted)] mb-1">Original Duration</p>
                  <p className="text-xl font-mono">{formatTime(stats?.originalDuration || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] mb-1">Optimized Duration</p>
                  <p className="text-xl font-mono text-[var(--accent)]">{formatTime(stats?.optimizedDuration || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] mb-1">Silence Removed</p>
                  <p className="text-xl font-mono text-green-400">
                    {Math.max(0, (stats?.originalDuration || 0) - (stats?.optimizedDuration || 0)).toFixed(1)}s
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] mb-1">Time Saved</p>
                  <p className="text-xl font-mono text-green-400">
                    {stats?.originalDuration ? Math.round(((stats.originalDuration - stats.optimizedDuration) / stats.originalDuration) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-3xl border bg-[var(--surface)] flex flex-col items-center justify-center text-center" style={{ borderColor: "var(--card-border)" }}>
               <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mb-6">
                 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
               </div>
               <h3 className="text-2xl font-bold mb-6">Processing Complete</h3>
               
               <div className="flex flex-col w-full gap-3">
                 <a 
                   href={outputUrl!}
                   download="voiceover_optimized.mp3"
                   className="w-full py-4 rounded-xl text-base font-black tracking-wide uppercase transition-all flex items-center justify-center gap-3 shadow-xl hover:scale-105 active:scale-95"
                   style={{ background: "var(--accent)", color: "#09090D", boxShadow: "0 10px 40px -10px var(--accent)" }}
                 >
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   Download MP3
                 </a>
                 <button 
                   onClick={() => {
                     setStatus("idle");
                     setOutputUrl(null);
                     setStats(null);
                   }}
                   className="w-full py-3 rounded-xl text-sm font-semibold transition-colors border hover:bg-white/5 text-[var(--muted)] hover:text-white"
                   style={{ borderColor: "var(--card-border)" }}
                 >
                   Process Another Audio
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
