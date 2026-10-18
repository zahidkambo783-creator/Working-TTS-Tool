"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import TextPanel from "@/components/TextPanel";
import VoiceSelector, { Voice } from "@/components/VoiceSelector";
import VoiceCloner from "@/components/VoiceCloner";
import ControlsPanel, { ControlValues } from "@/components/ControlsPanel";
import HistoryPanel, { HistoryItem } from "@/components/HistoryPanel";
import AudioPlayer from "@/components/AudioPlayer";
import SilenceRemover from "@/components/SilenceRemover";
import ZKIntro from "@/components/intro/ZKIntro";
import { get, set, del } from "idb-keyval";

const DEFAULT_VOICE = "en-US-AriaNeural";

type ViewType = "home" | "tts" | "voice-changer" | "silence-remover" | "voice-library" | "elevenlabs-library" | "kokoro-library" | "my-voices" | "favourite-voices" | "clone-voice" | "projects" | "history" | "settings";

export default function Home() {
  const [activeView, setActiveView] = useState<ViewType>("home");
  
  // Intro State
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem("zk_seen_intro")) {
      setShowIntro(false);
    }
  }, []);

  const handleIntroComplete = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("zk_seen_intro", "true");
    }
    setShowIntro(false);
  };
  
  // State
  const [text, setText] = useState("");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  
  // API Keys
  const [elevenLabsKeysRaw, setElevenLabsKeysRaw] = useState("");
  const [hfToken, setHfToken] = useState("");
  const [replicateToken, setReplicateToken] = useState("");
  const [elevenVoices, setElevenVoices] = useState<any[]>([]);
  const [elevenLoading, setElevenLoading] = useState(false);
  const [elevenTab, setElevenTab] = useState<"default" | "premium">("default");
  const [voiceProvider, setVoiceProvider] = useState<"edge" | "elevenlabs" | "kokoro" | "f5">("edge");
  const [clonedVoices, setClonedVoices] = useState<any[]>([]);

  // Favorites State
  type FavoriteVoice = { id: string; provider: "edge" | "elevenlabs" | "kokoro" | "f5"; name: string; subtitle: string; };
  const [favorites, setFavorites] = useState<FavoriteVoice[]>([]);

  const toggleFavorite = (fav: FavoriteVoice) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.id === fav.id && f.provider === fav.provider);
      if (exists) return prev.filter(f => !(f.id === fav.id && f.provider === fav.provider));
      return [...prev, fav];
    });
  };

  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
  const [controls, setControls] = useState<ControlValues>({ rate: 0, pitch: 0, volume: 0 });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const prevAudioUrl = useRef<string | null>(null);

  // Load history & API keys from localStorage/IndexedDB
  useEffect(() => {
    try {
      const savedKeys = localStorage.getItem("elevenlabs-keys");
      if (savedKeys) setElevenLabsKeysRaw(savedKeys);
      
      const savedHf = localStorage.getItem("hf-token");
      if (savedHf) setHfToken(savedHf);

      const savedReplicate = localStorage.getItem("replicate-token");
      if (savedReplicate) setReplicateToken(savedReplicate);

      const savedFavs = localStorage.getItem("zk_favorites");
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
    } catch (e) {
      console.error("Failed to load local data", e);
    }

    // Load History from IndexedDB
    get("zk-voice-history")
      .then((saved) => {
        if (saved && Array.isArray(saved)) {
          setHistory(saved.map((item: any) => ({ ...item, createdAt: new Date(item.createdAt) })));
        }
      })
      .catch((e) => console.error("Failed to load history from IndexedDB", e));
  }, []);

  // Save history to IndexedDB
  useEffect(() => {
    if (history.length > 0) {
      set("zk-voice-history", history).catch(e => console.error("Failed to save history", e));
    } else {
      del("zk-voice-history").catch(e => console.error("Failed to delete history", e));
    }
  }, [history]);

  useEffect(() => {
    localStorage.setItem("zk_favorites", JSON.stringify(favorites));
  }, [favorites]);

  // Load Cloned Voices
  const fetchClonedVoices = useCallback(() => {
    fetch("/api/voice-clone")
      .then(r => r.json())
      .then(data => {
         if (Array.isArray(data)) setClonedVoices(data);
      })
      .catch(e => console.error("Failed to load cloned voices", e));
  }, []);

  useEffect(() => {
    fetchClonedVoices();
  }, [fetchClonedVoices]);

  // Load Edge Voices
  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setVoices(data);
      })
      .catch(() => setError("Failed to load Edge voice list."))
      .finally(() => setVoicesLoading(false));
  }, []);

  // Load ElevenLabs Voices
  useEffect(() => {
    const keys = elevenLabsKeysRaw.split("\n").map(k => k.trim()).filter(k => k.length > 0);
    const firstKey = keys.length > 0 ? keys[0] : "";

    setElevenLoading(true);
    const headers: Record<string, string> = {};
    if (firstKey) headers["x-elevenlabs-key"] = firstKey;

    fetch("/api/elevenlabs/voices", { headers })
      .then(r => r.json())
      .then(data => {
        if (data.voices) setElevenVoices(data.voices);
      })
      .catch(e => console.error(e))
      .finally(() => setElevenLoading(false));
  }, [elevenLabsKeysRaw]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (prevAudioUrl.current) URL.revokeObjectURL(prevAudioUrl.current);
    };
  }, []);

  const generate = useCallback(async () => {
    if (!text.trim()) {
      setError("Please enter some text first.");
      return;
    }
    setError(null);
    setGenerating(true);
    setAudioUrl(null);
    if (prevAudioUrl.current) {
      URL.revokeObjectURL(prevAudioUrl.current);
      prevAudioUrl.current = null;
    }
    try {
      let res;
      let voiceNameLabel = selectedVoice;

      if (voiceProvider === "edge") {
        const rateStr = controls.rate === 0 ? "+0%" : `${controls.rate > 0 ? "+" : ""}${controls.rate}%`;
        const pitchStr = controls.pitch === 0 ? "+0Hz" : `${controls.pitch > 0 ? "+" : ""}${controls.pitch}Hz`;
        const volStr = controls.volume === 0 ? "+0%" : `${controls.volume > 0 ? "+" : ""}${controls.volume}%`;

        res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: selectedVoice, rate: rateStr, pitch: pitchStr, volume: volStr }),
        });
        const voiceObj = voices.find((v) => v.ShortName === selectedVoice);
        if (voiceObj) voiceNameLabel = voiceObj.FriendlyName;
      } else if (voiceProvider === "elevenlabs") {
        const keys = elevenLabsKeysRaw.split("\n").map(k => k.trim()).filter(k => k.length > 0);
        if (keys.length === 0) {
          throw new Error("Please add at least one ElevenLabs API key in Settings.");
        }

        let success = false;
        let lastError = null;

        for (const key of keys) {
          try {
            res = await fetch("/api/elevenlabs/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-elevenlabs-key": key },
              body: JSON.stringify({ text, voiceId: selectedVoice }),
            });
            
            if (res.ok) {
              success = true;
              break;
            } else if (res.status === 401 || res.status === 429) {
              lastError = await res.json().catch(() => ({}));
              console.warn("Key failed, rotating...", lastError);
            } else {
              lastError = await res.json().catch(() => ({}));
              throw new Error(lastError.error || "Failed to generate audio with ElevenLabs");
            }
          } catch (e: any) {
             lastError = e;
          }
        }

        if (!success) {
          let errorMsg = "All ElevenLabs keys failed or ran out of quota!";
          if (lastError) {
             const detail = lastError.error || lastError.message || JSON.stringify(lastError);
             errorMsg += ` Detail: ${detail}`;
          }
          throw new Error(errorMsg);
        }

        const elVoice = elevenVoices.find((v) => v.voice_id === selectedVoice);
        if (elVoice) voiceNameLabel = elVoice.name;
      } else if (voiceProvider === "kokoro") {
        res = await fetch("http://localhost:5000/api/tts/kokoro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: selectedVoice }),
        });
        voiceNameLabel = `Kokoro (${selectedVoice})`;
      } else if (voiceProvider === "f5") {
        if (!selectedVoice.startsWith("voice_")) throw new Error("Please select a cloned voice from 'My Voices' first.");
        
        const formData = new FormData();
        formData.append("text", text);
        formData.append("voice_id", selectedVoice);
        if (replicateToken) formData.append("replicate_token", replicateToken);
        if (hfToken) formData.append("hf_token", hfToken);
        
        res = await fetch("/api/f5tts", {
          method: "POST",
          body: formData,
        });
        const cv = clonedVoices.find(v => v.id === selectedVoice);
        voiceNameLabel = cv ? cv.voice_name : "Cloned Voice";
      }

      if (res && res.ok) {
        // Check if the response is actually an audio file, not a JSON error disguised as 200 OK
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
           const errData = await res.json();
           throw new Error(errData.error || "Backend returned an unexpected JSON response.");
        }

        const blob = await res.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioUrl(base64data);
          const newItem: HistoryItem = {
            id: crypto.randomUUID(),
            text,
            voice: voiceNameLabel,
            audioUrl: base64data,
            createdAt: new Date(),
          };
          setHistory((prev) => [newItem, ...prev].slice(0, 10));
        };
      } else if (res) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate audio");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setGenerating(false);
    }
  }, [text, selectedVoice, controls, voices, voiceProvider, elevenLabsKeysRaw, elevenVoices]);

  const [kokoroPreviewLoading, setKokoroPreviewLoading] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const playVoicePreview = async (provider: string, voiceId: string) => {
    const uniqueId = `${provider}-${voiceId}`;
    if (previewPlayingId === uniqueId) {
      previewAudioRef.current?.pause();
      setPreviewPlayingId(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPreviewPlayingId(null);
    }

    setPreviewLoadingId(uniqueId);
    const text = "Hello there! This is a quick preview of my voice.";
    
    try {
      let res;
      if (provider === "kokoro") {
        try {
          res = await fetch(`/previews/kokoro/${voiceId}.wav`);
          if (!res.ok) throw new Error();
        } catch {
          res = await fetch("http://localhost:5000/api/tts/kokoro", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice: voiceId }),
          });
        }
      } else if (provider === "f5") {
        // Play the original cloned voice sample directly and instantly!
        res = await fetch(`/api/voice-clone/audio?id=${voiceId}`);
      } else if (provider === "elevenlabs") {
        const key = elevenLabsKeysRaw.split("\n")[0]?.trim();
        if (!key) {
           throw new Error("API Key required. Please add your ElevenLabs API key in Settings.");
        }
        res = await fetch("/api/elevenlabs/tts", {
          method: "POST", headers: { "Content-Type": "application/json", "x-elevenlabs-key": key },
          body: JSON.stringify({ text, voiceId }),
        });
      } else {
        // edge
        res = await fetch("/api/edge/tts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: voiceId, rate: 0, pitch: 0, volume: 0 }),
        });
      }

      if (!res.ok) throw new Error("Failed to generate preview");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => {
        setPreviewPlayingId(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
      setPreviewPlayingId(uniqueId);
    } catch (e: any) {
      alert("Preview error: " + e.message);
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const toggleActivePreview = () => playVoicePreview(voiceProvider, selectedVoice);

  const [keyTestStatus, setKeyTestStatus] = useState<string | null>(null);
  const [keyTestLoading, setKeyTestLoading] = useState(false);

  const testApiKeys = async () => {
    const keys = elevenLabsKeysRaw.split("\n").map(k => k.trim()).filter(k => k.length > 0);
    if (keys.length === 0) {
      setKeyTestStatus("❌ Please enter at least one key.");
      return;
    }
    setKeyTestLoading(true);
    setKeyTestStatus("⏳ Testing...");
    
    let working = 0;
    let failed = 0;
    
    for (const key of keys) {
      try {
        const res = await fetch("/api/elevenlabs/voices", { headers: { "x-elevenlabs-key": key } });
        if (res.ok) {
          working++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }
    setKeyTestLoading(false);
    setKeyTestStatus(`✅ ${working} working | ❌ ${failed} failed`);
  };

  const handleDownload = useCallback(() => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `zk-voice-${Date.now()}.mp3`;
    a.click();
  }, [audioUrl]);

  const selectedVoiceObj = voices.find((v) => v.ShortName === selectedVoice);

  let displayVoiceName = "Select a Voice";
  let displayVoiceSubtitle = "No provider selected";

  if (voiceProvider === "edge") {
    displayVoiceName = selectedVoiceObj?.FriendlyName ?? selectedVoice.split("-").pop()?.replace("Neural", "") ?? "Edge Voice";
    displayVoiceSubtitle = `${selectedVoiceObj?.Gender ?? "Unknown"} • ${selectedVoiceObj?.Locale.split("-")[1] ?? "Locale"}`;
  } else if (voiceProvider === "elevenlabs") {
    displayVoiceName = elevenVoices.find(v => v.voice_id === selectedVoice)?.name ?? "ElevenLabs Voice";
    displayVoiceSubtitle = "ElevenLabs AI";
  } else if (voiceProvider === "kokoro") {
    const kVoices = { af_heart: "American Female (Heart)", af_alloy: "American Female (Alloy)", am_adam: "American Male (Adam)", am_echo: "American Male (Echo)" };
    displayVoiceName = kVoices[selectedVoice as keyof typeof kVoices] ?? "Kokoro Voice";
    displayVoiceSubtitle = "Local Offline AI";
  } else if (voiceProvider === "f5") {
    displayVoiceName = clonedVoices.find(v => v.id === selectedVoice)?.voice_name ?? "Cloned Voice";
    displayVoiceSubtitle = "F5 Zero-Shot Clone";
  }

  // Components for Sidebar Navigation
  const NavItem = ({ id, label, icon }: { id: ViewType, label: string, icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveView(id)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer text-sm font-medium ${
        activeView === id 
          ? "bg-[var(--elevated)] text-[var(--accent)]" 
          : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--elevated)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      {showIntro && <ZKIntro onComplete={handleIntroComplete} appReady={!voicesLoading} />}
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)", color: "var(--foreground)" }}>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-[250px] border-r shrink-0" style={{ borderColor: "var(--card-border)", background: "var(--sidebar)" }}>
        {/* Branding */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#09090D] font-bold" style={{ background: "var(--accent)" }}>
              ZK
            </div>
            <div className="flex flex-col">
              <h1 className="font-bold text-sm tracking-wide leading-tight">ZK Voice Studio</h1>
              <span className="text-[10px] uppercase tracking-widest opacity-60">AI Voice Studio</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-6">
          
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-widest px-3 py-2" style={{ color: "var(--muted)" }}>Create</span>
            <NavItem id="home" label="Home" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>} />
            <NavItem id="tts" label="Text to Speech" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>} />
            <NavItem id="voice-changer" label="Voice Changer" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>} />
            <NavItem id="silence-remover" label="Audio Silence Remover" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-widest px-3 py-2" style={{ color: "var(--muted)" }}>Voices</span>
            <NavItem id="voice-library" label="Edge Voices" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>} />
            <NavItem id="elevenlabs-library" label="11 Lab Voices" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>} />
            <NavItem id="kokoro-library" label="Kokoro Voices" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>} />
            <NavItem id="my-voices" label="My Voices" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>} />
            <NavItem id="favourite-voices" label="Favourite Voices" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>} />
            <NavItem id="clone-voice" label="Clone a Voice" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>} />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-widest px-3 py-2" style={{ color: "var(--muted)" }}>Workspace</span>
            <NavItem id="projects" label="Projects" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>} />
            <NavItem id="history" label="History" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          </div>

        </div>

        {/* Bottom Sidebar */}
        <div className="p-4 border-t flex flex-col gap-1" style={{ borderColor: "var(--card-border)" }}>
          <NavItem id="settings" label="Settings" icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014-5.395c-.312.053-.627.1-.942.145M19.175 4.125a23.92 23.92 0 01-1.014 5.395m2.877-1.12c-.392.556-.83 1.088-1.31 1.59m2.877-1.12a24.248 24.248 0 00-3.411 2.22" /></svg>} />
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--elevated)]">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
            Help & Support
          </button>
          
          <div className="mt-4 flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: "var(--card-border)", background: "var(--surface)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--elevated)] border" style={{ borderColor: "var(--card-border)" }}>
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style={{ color: "var(--muted)" }}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium">Free Plan</span>
                <span className="text-[10px]" style={{ color: "var(--muted)" }}>0 / 10k chars</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: "var(--card-border)", background: "var(--sidebar)" }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-[#09090D] font-bold text-xs" style={{ background: "var(--accent)" }}>ZK</div>
            <h1 className="font-bold text-sm">Voice Studio</h1>
          </div>
          <div className="flex items-center gap-2 text-[10px] px-2 py-1 rounded-md" style={{ background: "var(--surface)", border: "1px solid var(--card-border)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
            <span style={{ color: "var(--muted)" }}>Ready</span>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto w-full">
            
            {/* Error banner */}
            {error && (
              <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 1.998-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" /></svg>
                {error}
                <button onClick={() => setError(null)} className="ml-auto cursor-pointer hover:opacity-70">✕</button>
              </div>
            )}

            {/* HOME WORKSPACE */}
            {activeView === "home" && (
              <div className="flex flex-col gap-8 animate-in fade-in duration-500">
                {/* Hero Banner */}
                <div 
                  className="w-full rounded-3xl overflow-hidden relative border shadow-2xl flex flex-col justify-center items-center p-12 text-center"
                  style={{ 
                    borderColor: "var(--card-border)", 
                    background: "radial-gradient(ellipse at center, rgba(139,114,255,0.15) 0%, var(--surface) 100%)",
                    minHeight: "350px"
                  }}
                >
                  {/* Subtle background pattern */}
                  <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20z' fill='%23ffffff' fill-opacity='0.02' fill-rule='evenodd'/%3E%3C/svg%3E\")" }}></div>
                  
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(139,114,255,0.3)] relative z-10" style={{ background: "var(--accent)", color: "#09090D" }}>
                    <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v9.28a4.39 4.39 0 0 0-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/></svg>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-white relative z-10">Welcome to ZK Voice Studio</h1>
                  <p className="text-base md:text-lg mb-8 max-w-2xl relative z-10" style={{ color: "var(--muted)" }}>
                    The ultimate AI voice workstation. Generate studio-quality audio, explore hundreds of diverse voices, and bring your scripts to life with cutting-edge synthesis.
                  </p>
                  <button 
                    onClick={() => setActiveView("tts")}
                    className="px-8 py-4 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-xl relative z-10 text-sm flex items-center gap-2 cursor-pointer"
                    style={{ background: "var(--foreground)", color: "var(--background)" }}
                  >
                    Start Creating Now
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z" /></svg>
                  </button>
                </div>
                
                {/* Stats / Quick Links */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-2xl border cursor-pointer group hover:border-[var(--accent)] transition-all bg-[var(--surface)] relative overflow-hidden" onClick={() => setActiveView("voice-library")}>
                     <div className="absolute top-0 right-0 p-6 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                       <svg width="100" height="100" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 16.5a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"/></svg>
                     </div>
                     <h3 className="text-3xl font-black text-white mb-1">322+</h3>
                     <p className="text-sm font-medium mb-1" style={{ color: "var(--accent)" }}>AI Voices</p>
                     <p className="text-xs" style={{ color: "var(--muted)" }}>Explore diverse accents and languages across the globe.</p>
                  </div>
                  
                  <div className="p-6 rounded-2xl border cursor-pointer group hover:border-[var(--accent)] transition-all bg-[var(--surface)] relative overflow-hidden" onClick={() => setActiveView("clone-voice")}>
                     <div className="absolute top-0 right-0 p-6 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                       <svg width="100" height="100" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4.5v15m7.5-7.5h-15" stroke="currentColor" strokeWidth={2}/></svg>
                     </div>
                     <h3 className="text-3xl font-black text-white mb-1">Clone</h3>
                     <p className="text-sm font-medium mb-1" style={{ color: "var(--accent)" }}>Custom Voices</p>
                     <p className="text-xs" style={{ color: "var(--muted)" }}>Train AI models on your own personal audio samples.</p>
                  </div>
                  
                  <div className="p-6 rounded-2xl border cursor-pointer group hover:border-[var(--accent)] transition-all bg-[var(--surface)] relative overflow-hidden" onClick={() => setActiveView("history")}>
                     <div className="absolute top-0 right-0 p-6 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                       <svg width="100" height="100" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                     </div>
                     <h3 className="text-3xl font-black text-white mb-1">{history.length}</h3>
                     <p className="text-sm font-medium mb-1" style={{ color: "var(--accent)" }}>Generations</p>
                     <p className="text-xs" style={{ color: "var(--muted)" }}>Quickly access and download your past audio files.</p>
                  </div>
                </div>
              </div>
            )}

            {/* TTS WORKSPACE */}
            {activeView === "tts" && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold tracking-tight">Text to Speech</h2>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setText("")} className="text-xs px-3 py-1.5 rounded-md border transition-all hover:bg-[var(--elevated)] cursor-pointer" style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}>Clear Script</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Script Editor & Player */}
                  <div className="lg:col-span-8 flex flex-col gap-6">
                    <TextPanel text={text} onChange={setText} />
                    <AudioPlayer 
                      audioUrl={audioUrl} 
                      voiceName={selectedVoiceObj?.FriendlyName ?? selectedVoice} 
                      generating={generating} 
                      onDownload={handleDownload} 
                      onSendToSilenceRemover={() => setActiveView("silence-remover")}
                    />
                  </div>
                  
                  {/* Right Column: Voice Selection & Settings */}
                  <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="rounded-2xl border flex flex-col overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}>
                      <div className="px-5 py-4 border-b flex flex-col gap-2" style={{ borderColor: "var(--card-border)" }}>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm">Voice Settings</h3>
                          <button 
                            onClick={() => {
                              if (voiceProvider === "edge") setActiveView("voice-library");
                              else if (voiceProvider === "elevenlabs") setActiveView("elevenlabs-library");
                              else if (voiceProvider === "kokoro") setActiveView("kokoro-library");
                              else if (voiceProvider === "f5") setActiveView("my-voices");
                            }} 
                            className="text-[11px] transition-colors cursor-pointer" 
                            style={{ color: "var(--accent)" }}
                          >
                            Change Voice
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-5 flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={toggleActivePreview}
                            disabled={previewLoadingId === `${voiceProvider}-${selectedVoice}`}
                            className="w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer hover:scale-105 disabled:opacity-50" 
                            style={{ 
                              background: previewPlayingId === `${voiceProvider}-${selectedVoice}` ? "var(--accent)" : "var(--elevated)", 
                              borderColor: previewPlayingId === `${voiceProvider}-${selectedVoice}` ? "var(--accent)" : "var(--card-border)",
                              color: previewPlayingId === `${voiceProvider}-${selectedVoice}` ? "#09090D" : "var(--muted)"
                            }}
                            title="Play Preview"
                          >
                            {previewLoadingId === `${voiceProvider}-${selectedVoice}` ? (
                              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                            ) : previewPlayingId === `${voiceProvider}-${selectedVoice}` ? (
                              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                            ) : (
                              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" className="ml-1"><path d="M8 5v14l11-7z" /></svg>
                            )}
                          </button>
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-medium text-sm truncate">{displayVoiceName}</span>
                            <span className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{displayVoiceSubtitle}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <ControlsPanel controls={controls} onChange={setControls} />
                    
                    <button
                      onClick={generate}
                      disabled={generating || !text.trim()}
                      className="w-full py-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
                      style={{ background: generating ? "var(--background)" : "var(--accent)", color: generating ? "var(--muted)" : "#09090D", border: generating ? "1px solid var(--card-border)" : "none" }}
                    >
                      {generating ? (
                        <><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Synthesizing Audio...</>
                      ) : "Generate Audio"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SILENCE REMOVER WORKSPACE */}
            {activeView === "silence-remover" && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <SilenceRemover initialAudioUrl={audioUrl} />
              </div>
            )}

            {/* VOICE CHANGER WORKSPACE */}
            {activeView === "voice-changer" && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <h2 className="text-2xl font-bold mb-2 tracking-tight">Voice Changer</h2>
                <div className="rounded-2xl border p-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}>
                  <p style={{ color: "var(--muted)" }}>Voice Changer workspace is coming soon.</p>
                </div>
              </div>
            )}

            {/* VOICE LIBRARY WORKSPACE */}
            {activeView === "voice-library" && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <div className="flex flex-col mb-2">
                  <h2 className="text-2xl font-bold tracking-tight">Edge Voice Library</h2>
                  <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Explore and preview 300+ free Microsoft Edge TTS voices.</p>
                </div>
                <VoiceSelector 
                  voices={voices} 
                  selected={voiceProvider === "edge" ? selectedVoice : ""} 
                  onSelect={(voice) => {
                    setVoiceProvider("edge");
                    setSelectedVoice(voice);
                    setActiveView("tts");
                  }} 
                  loading={voicesLoading} 
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite as any}
                />
              </div>
            )}

            {/* KOKORO LIBRARY WORKSPACE */}
            {activeView === "kokoro-library" && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <div className="flex flex-col mb-2">
                  <h2 className="text-2xl font-bold tracking-tight">Kokoro Voices</h2>
                  <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Local, ultra-realistic offline text-to-speech voices.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: "af_heart", name: "American Female (Heart)", gender: "Female" },
                    { id: "af_alloy", name: "American Female (Alloy)", gender: "Female" },
                    { id: "am_adam", name: "American Male (Adam)", gender: "Male" },
                    { id: "am_echo", name: "American Male (Echo)", gender: "Male" },
                  ].map(voice => {
                    const isFav = favorites.some(f => f.id === voice.id && f.provider === "kokoro");
                    return (
                    <div key={voice.id} className="relative p-4 rounded-xl border flex flex-col gap-2 transition-colors hover:border-[var(--accent)] cursor-pointer" style={{ background: "var(--surface)", borderColor: "var(--card-border)" }} onClick={() => {
                      setVoiceProvider("kokoro");
                      setSelectedVoice(voice.id);
                      setActiveView("tts");
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite({ id: voice.id, provider: "kokoro", name: voice.name, subtitle: voice.gender });
                        }}
                        className={`absolute top-3 right-16 p-1.5 rounded-full transition-colors ${isFav ? "text-red-500 bg-red-500/10" : "text-[var(--muted)] hover:text-white hover:bg-white/10"}`}
                        title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                      >
                        <svg width="14" height="14" fill={isFav ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isFav ? 0 : 2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                      </button>
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold pr-16">{voice.name}</h4>
                        <span className="text-[10px] uppercase font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded">Local</span>
                      </div>
                      <div className="flex justify-between items-end mt-2">
                        <p className="text-xs text-[var(--muted)]">Gender: {voice.gender}</p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            playVoicePreview("kokoro", voice.id);
                          }}
                          disabled={previewLoadingId === `kokoro-${voice.id}`}
                          className="px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 hover:bg-[var(--elevated)]"
                          style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
                          title="Preview Voice"
                        >
                          {previewLoadingId === `kokoro-${voice.id}` ? (
                            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                          ) : previewPlayingId === `kokoro-${voice.id}` ? (
                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                          ) : (
                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            )}

            {/* ELEVENLABS LIBRARY WORKSPACE */}
            {activeView === "elevenlabs-library" && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <div className="flex flex-col mb-2">
                  <h2 className="text-2xl font-bold tracking-tight">11 Lab Voices</h2>
                  <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Access premium, hyper-realistic voices from ElevenLabs.</p>
                </div>

                <div className="flex gap-2 mb-4 p-1 rounded-lg border bg-[var(--surface)] w-fit" style={{ borderColor: "var(--card-border)" }}>
                  <button 
                    onClick={() => setElevenTab("default")}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${elevenTab === "default" ? "bg-[var(--elevated)] shadow-sm" : "text-[var(--muted)] hover:text-white"}`}
                  >
                    Default Voices
                  </button>
                  <button 
                    onClick={() => setElevenTab("premium")}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${elevenTab === "premium" ? "bg-[var(--elevated)] shadow-sm" : "text-[var(--muted)] hover:text-white"}`}
                  >
                    Premium / Custom
                  </button>
                </div>

                {elevenLoading ? (
                   <div className="py-20 flex justify-center"><svg className="animate-spin h-8 w-8 text-[var(--accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
                ) : elevenTab === "premium" && !elevenLabsKeysRaw ? (
                  <div className="rounded-2xl border p-12 flex flex-col items-center text-center gap-4" style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[var(--accent-glow)] text-[var(--accent)]">
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">API Key Required</h3>
                      <p className="text-sm max-w-md mx-auto mt-2" style={{ color: "var(--muted)" }}>
                        To access your cloned or premium ElevenLabs voices, you need to provide your API key.
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveView("settings")} 
                      className="mt-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all hover:scale-105 cursor-pointer"
                      style={{ background: "var(--foreground)", color: "var(--background)" }}
                    >
                      Go to Settings
                    </button>
                  </div>
                ) : (() => {
                  const filteredVoices = elevenVoices.filter(v => elevenTab === "default" ? v.category === "premade" : v.category !== "premade");
                  if (filteredVoices.length === 0) {
                    return (
                      <div className="rounded-2xl border p-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}>
                        <h3 className="font-medium text-lg mb-2">No custom voices found</h3>
                        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>You don't have any cloned or premium voices on this ElevenLabs account.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {filteredVoices.map(voice => {
                        const isFav = favorites.some(f => f.id === voice.voice_id && f.provider === "elevenlabs");
                      return (
                      <div 
                        key={voice.voice_id}
                        onClick={() => {
                          setVoiceProvider("elevenlabs");
                          setSelectedVoice(voice.voice_id);
                          setActiveView("tts");
                        }}
                        className="relative rounded-xl border p-4 cursor-pointer transition-all hover:-translate-y-1"
                        style={{ 
                          background: "var(--surface)", 
                          borderColor: (voiceProvider === "elevenlabs" && selectedVoice === voice.voice_id) ? "var(--accent)" : "var(--card-border)",
                          boxShadow: (voiceProvider === "elevenlabs" && selectedVoice === voice.voice_id) ? "0 0 0 1px var(--accent)" : "none"
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite({ id: voice.voice_id, provider: "elevenlabs", name: voice.name, subtitle: voice.labels?.description || "Professional Voice" });
                          }}
                          className={`absolute top-3 right-3 p-1.5 rounded-full transition-colors ${isFav ? "text-red-500 bg-red-500/10" : "text-[var(--muted)] hover:text-white hover:bg-white/10"}`}
                          title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                        >
                          <svg width="14" height="14" fill={isFav ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isFav ? 0 : 2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                          </svg>
                        </button>
                        <div className="flex justify-between items-start mb-2 pr-8">
                          <h4 className="font-bold text-sm truncate">{voice.name}</h4>
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                           {voice.labels?.description || "Professional Voice"} • {voice.labels?.gender || "Unknown"}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              playVoicePreview("elevenlabs", voice.voice_id);
                            }}
                            disabled={previewLoadingId === `elevenlabs-${voice.voice_id}`}
                            className="px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 hover:bg-[var(--elevated)]"
                            style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
                            title="Preview Voice"
                          >
                            {previewLoadingId === `elevenlabs-${voice.voice_id}` ? (
                              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                            ) : previewPlayingId === `elevenlabs-${voice.voice_id}` ? (
                              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                            ) : (
                              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            )}
                          </button>
                          {voice.labels?.accent && <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-[var(--background)] border" style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}>{voice.labels.accent}</span>}
                        </div>
                      </div>
                    )})}
                  </div>
                  );
                })()}
              </div>
            )}

            {/* MY VOICES WORKSPACE */}
            {activeView === "my-voices" && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-col">
                    <h2 className="text-2xl font-bold tracking-tight">My Voices</h2>
                    <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Your cloned and custom voice models.</p>
                  </div>
                  <button onClick={() => setActiveView("clone-voice")} className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 cursor-pointer" style={{ background: "var(--accent)", color: "white" }}>+ Clone Voice</button>
                </div>
                {clonedVoices.length === 0 ? (
                  <div className="rounded-2xl border p-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}>
                     <h3 className="font-medium text-lg mb-2">No custom voices yet</h3>
                     <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Clone your voice or save favorites to access them here.</p>
                     <button onClick={() => setActiveView("clone-voice")} className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--elevated)] cursor-pointer" style={{ borderColor: "var(--card-border)" }}>Get Started</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clonedVoices.map(cv => {
                      const isFav = favorites.some(f => f.id === cv.id && f.provider === "f5");
                      return (
                      <div key={cv.id} className="relative p-4 rounded-xl border flex flex-col gap-2 transition-colors hover:border-[var(--accent)]" style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite({ id: cv.id, provider: "f5", name: cv.voice_name, subtitle: "Cloned Voice" });
                          }}
                          className={`absolute top-3 right-16 p-1.5 rounded-full transition-colors ${isFav ? "text-red-500 bg-red-500/10" : "text-[var(--muted)] hover:text-white hover:bg-white/10"}`}
                          title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                        >
                          <svg width="14" height="14" fill={isFav ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isFav ? 0 : 2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                          </svg>
                        </button>
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold pr-16">{cv.voice_name}</h4>
                          <span className="text-[10px] uppercase font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded">Ready</span>
                        </div>
                        <p className="text-xs text-[var(--muted)] truncate">ID: {cv.id}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button 
                            onClick={() => playVoicePreview("f5", cv.id)}
                            disabled={previewLoadingId === `f5-${cv.id}`}
                            className="px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 hover:bg-[var(--elevated)]"
                            style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
                            title="Preview Cloned Voice"
                          >
                            {previewLoadingId === `f5-${cv.id}` ? (
                              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                            ) : previewPlayingId === `f5-${cv.id}` ? (
                              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                            ) : (
                              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            )}
                          </button>
                          <button 
                            onClick={() => {
                              setVoiceProvider("f5");
                              setSelectedVoice(cv.id);
                              setActiveView("tts");
                            }}
                            className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border hover:bg-[var(--elevated)] transition-colors cursor-pointer"
                            style={{ borderColor: "var(--card-border)" }}
                          >
                            Use Voice
                          </button>
                          <button 
                            onClick={() => {
                              if(confirm("Delete this cloned voice?")) {
                                fetch(`/api/voice-clone?id=${cv.id}`, { method: "DELETE" })
                                  .then(() => fetchClonedVoices());
                              }
                            }}
                            className="px-3 py-2 text-xs font-medium rounded-lg border text-red-500 hover:bg-red-500/10 transition-colors"
                            style={{ borderColor: "var(--card-border)" }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            )}
            {/* FAVOURITE VOICES WORKSPACE */}
            {activeView === "favourite-voices" && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <div className="flex flex-col mb-2">
                  <h2 className="text-2xl font-bold tracking-tight">Favourite Voices</h2>
                  <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Your saved voices from all libraries.</p>
                </div>
                {favorites.length === 0 ? (
                  <div className="rounded-2xl border p-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}>
                     <h3 className="font-medium text-lg mb-2">No favorites yet</h3>
                     <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Explore the voice libraries and click the heart icon to save your favorite voices here.</p>
                     <div className="flex gap-4 justify-center">
                       <button onClick={() => setActiveView("voice-library")} className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--elevated)] cursor-pointer" style={{ borderColor: "var(--card-border)" }}>Explore Edge</button>
                       <button onClick={() => setActiveView("kokoro-library")} className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--elevated)] cursor-pointer" style={{ borderColor: "var(--card-border)" }}>Explore Kokoro</button>
                     </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {favorites.map(fav => (
                      <div key={`${fav.provider}-${fav.id}`} className="relative p-4 rounded-xl border flex flex-col gap-2 transition-colors hover:border-[var(--accent)]" style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(fav);
                          }}
                          className="absolute top-3 right-3 p-1.5 rounded-full transition-colors text-red-500 bg-red-500/10"
                          title="Remove from Favorites"
                        >
                          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                          </svg>
                        </button>
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold pr-8 truncate">{fav.name}</h4>
                          <span className="text-[10px] uppercase font-bold px-2 py-1 rounded" style={{
                            color: fav.provider === "kokoro" ? "#22c55e" : fav.provider === "f5" ? "#eab308" : fav.provider === "elevenlabs" ? "#c084fc" : "#3b82f6",
                            backgroundColor: fav.provider === "kokoro" ? "rgba(34, 197, 94, 0.1)" : fav.provider === "f5" ? "rgba(234, 179, 8, 0.1)" : fav.provider === "elevenlabs" ? "rgba(192, 132, 252, 0.1)" : "rgba(59, 130, 246, 0.1)"
                          }}>
                            {fav.provider}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted)]">{fav.subtitle}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              playVoicePreview(fav.provider, fav.id);
                            }}
                            disabled={previewLoadingId === `${fav.provider}-${fav.id}`}
                            className="px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 hover:bg-[var(--elevated)]"
                            style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
                            title="Preview Voice"
                          >
                            {previewLoadingId === `${fav.provider}-${fav.id}` ? (
                              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                            ) : previewPlayingId === `${fav.provider}-${fav.id}` ? (
                              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                            ) : (
                              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            )}
                          </button>
                          <button 
                            onClick={() => {
                              setVoiceProvider(fav.provider);
                              setSelectedVoice(fav.id);
                              setActiveView("tts");
                            }}
                            className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border hover:bg-[var(--elevated)] transition-colors cursor-pointer"
                            style={{ borderColor: "var(--card-border)" }}
                          >
                            Use Voice
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CLONE VOICE WORKSPACE */}
            {activeView === "clone-voice" && (
              <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full animate-in fade-in duration-300">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Clone a Voice</h2>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>Instantly clone any voice with a 10-second audio sample.</p>
                </div>
                <VoiceCloner 
                  onSuccess={(voiceId, voiceName) => {
                    fetchClonedVoices();
                    setActiveView("my-voices");
                  }} 
                />
              </div>
            )}

            {/* PROJECTS WORKSPACE */}
            {activeView === "projects" && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
                  <button className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 cursor-pointer" style={{ background: "var(--accent)", color: "#09090D" }}>New Project</button>
                </div>
                <div className="rounded-2xl border flex items-center justify-center min-h-[300px]" style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}>
                  <div className="text-center p-8">
                     <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center border" style={{ background: "var(--background)", borderColor: "var(--card-border)", color: "var(--muted)" }}>
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
                     </div>
                     <p className="font-medium mb-1">No active projects</p>
                     <p className="text-xs" style={{ color: "var(--muted)" }}>Create a new project to start organizing your generations.</p>
                  </div>
                </div>
              </div>
            )}

            {/* HISTORY WORKSPACE */}
            {activeView === "history" && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300 max-w-5xl">
                <h2 className="text-2xl font-bold mb-2 tracking-tight">Generation History</h2>
                <HistoryPanel items={history} onPlay={(item) => { setAudioUrl(item.audioUrl); setActiveView("tts"); }} onRemove={(id) => setHistory(prev => prev.filter(i => i.id !== id))} onClearAll={() => setHistory([])} />
              </div>
            )}

            {/* SETTINGS WORKSPACE */}
            {activeView === "settings" && (
              <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full animate-in fade-in duration-300">
                <h2 className="text-2xl font-bold mb-2 tracking-tight">Settings</h2>
                <div className="rounded-2xl border flex flex-col overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}>
                  
                  <div className="p-6 border-b" style={{ borderColor: "var(--card-border)" }}>
                    <h3 className="font-medium text-sm mb-1">Account Preferences</h3>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>Manage your profile and workspace settings.</p>
                  </div>
                  
                  <div className="p-6 border-b" style={{ borderColor: "var(--card-border)" }}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="font-medium text-sm mb-1">API Integrations</h3>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>Connect external services to unlock premium voices.</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>ElevenLabs API Keys (One per line)</label>
                      <div className="flex gap-2">
                        <textarea 
                          value={elevenLabsKeysRaw}
                          onChange={(e) => {
                             setElevenLabsKeysRaw(e.target.value);
                             localStorage.setItem("elevenlabs-keys", e.target.value);
                          }}
                          placeholder="sk_...\nsk_...\nsk_..."
                          className="flex-1 bg-transparent border rounded-lg px-4 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors min-h-[100px] resize-none"
                          style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
                        />
                      </div>
                      <p className="text-[10px] mt-1 mb-2" style={{ color: "var(--muted)" }}>Enter multiple API keys. ZK Voice Studio will automatically switch to the next key if one runs out of quota.</p>
                      
                      <div className="flex items-center gap-3 mt-1">
                        <button 
                          onClick={testApiKeys}
                          disabled={keyTestLoading}
                          className="px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                          style={{ background: "var(--elevated)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
                        >
                          {keyTestLoading ? "Testing..." : "Test API Keys"}
                        </button>
                        {keyTestStatus && (
                          <span className="text-xs font-medium">{keyTestStatus}</span>
                        )}
                      </div>
                      
                      <div className="mt-6 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Replicate API Token (Voice Cloning / F5-TTS)</label>
                          <a 
                            href="https://replicate.com/account/api-tokens" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[11px] text-[var(--accent)] hover:underline"
                          >
                            Get Free Token ↗
                          </a>
                        </div>
                        <input 
                          type="password"
                          value={replicateToken}
                          onChange={(e) => {
                             setReplicateToken(e.target.value);
                             localStorage.setItem("replicate-token", e.target.value);
                          }}
                          placeholder="r8_..."
                          className="w-full bg-transparent border rounded-lg px-4 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors"
                          style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
                        />
                        <p className="text-[10px] mt-1 mb-2" style={{ color: "var(--muted)" }}>Fast cloud Voice Cloning with no ZeroGPU quota limits and no queue delays.</p>
                      </div>

                    </div>
                  </div>
                  
                  <div className="p-6 bg-[var(--background)] text-center">
                    <p className="text-[11px]" style={{ color: "var(--muted)" }}>ZK Voice Studio v1.0.0</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden shrink-0 border-t flex justify-around p-2 pb-safe z-50 bg-[var(--sidebar)]" style={{ borderColor: "var(--card-border)" }}>
        {(["home", "tts", "voice-library", "history", "settings"] as const).map(tab => {
          const isSelected = activeView === tab;
          let icon, label;
          if (tab === "home") { label = "Home"; icon = <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>; }
          else if (tab === "tts") { label = "Create"; icon = <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>; }
          else if (tab === "voice-library") { label = "Voices"; icon = <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>; }
          else if (tab === "history") { label = "History"; icon = <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
          else if (tab === "settings") { label = "Settings"; icon = <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014-5.395c-.312.053-.627.1-.942.145M19.175 4.125a23.92 23.92 0 01-1.014 5.395m2.877-1.12c-.392.556-.83 1.088-1.31 1.59m2.877-1.12a24.248 24.248 0 00-3.411 2.22" /></svg>; }
          
          return (
            <button key={tab} onClick={() => setActiveView(tab)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors cursor-pointer ${isSelected ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
              {icon}
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </nav>
      
    </div>
    </>
  );
}
