"use client";

import { useState, useMemo, useRef } from "react";
import LanguageSelector from "./LanguageSelector";

export interface Voice {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  FriendlyName: string;
}

interface VoiceSelectorProps {
  voices: Voice[];
  selected: string;
  onSelect: (voiceShortName: string) => void;
  loading: boolean;
  favorites?: any[];
  onToggleFavorite?: (voice: any) => void;
}

const GENDER_ICONS: Record<string, string> = {
  Female: "♀",
  Male: "♂",
};

export default function VoiceSelector({
  voices,
  selected,
  onSelect,
  loading,
  favorites = [],
  onToggleFavorite
}: VoiceSelectorProps) {
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"All" | "Male" | "Female">("All");
  const [langFilter, setLangFilter] = useState("All");

  const languages = useMemo(() => {
    const langs = Array.from(new Set(voices.map((v) => v.Locale.split("-")[0].toUpperCase())));
    return ["All", ...langs.sort()];
  }, [voices]);

  const filtered = useMemo(() => {
    return voices.filter((v) => {
      const matchSearch =
        search === "" ||
        v.FriendlyName.toLowerCase().includes(search.toLowerCase()) ||
        v.ShortName.toLowerCase().includes(search.toLowerCase()) ||
        v.Locale.toLowerCase().includes(search.toLowerCase());
      const matchGender = genderFilter === "All" || v.Gender === genderFilter;
      const matchLang =
        langFilter === "All" ||
        v.Locale.toUpperCase().startsWith(langFilter);
      return matchSearch && matchGender && matchLang;
    });
  }, [voices, search, genderFilter, langFilter]);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePreview = async (e: React.MouseEvent, voice: Voice) => {
    e.stopPropagation(); // prevent selecting the voice
    
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      audioRef.current = null;
    }

    if (playingId === voice.ShortName) {
      setPlayingId(null);
      setLoadingPreviewId(null);
      return;
    }

    setPlayingId(null);
    setLoadingPreviewId(voice.ShortName);

    try {
      // Clean name for preview text (e.g. "Andrew")
      const nameOnly = voice.ShortName.split("-").pop()?.replace(/Neural$/, "").replace(/Multilingual$/, "") || "this voice";
      const previewText = `Hi, I am ${nameOnly}. This is a preview of my voice.`;

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: previewText,
          voice: voice.ShortName,
          rate: "+0%",
          pitch: "+0Hz",
          volume: "+0%",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load preview from server.");
      }

      const blob = await res.blob();
      const audioBlob = new Blob([blob], { type: "audio/mpeg" });
      const url = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingId(null);
      };
      
      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        setPlayingId(null);
        alert("Failed to play preview audio.");
      };

      await audio.play();
      setPlayingId(voice.ShortName);
    } catch (err) {
      console.error("Preview generation error:", err);
      alert(err instanceof Error ? err.message : "Error generating preview.");
      setPlayingId(null);
    } finally {
      setLoadingPreviewId(null);
    }
  };

  const selectedVoice = voices.find((v) => v.ShortName === selected);

  // Helper to format clean card names
  const formatVoiceName = (shortName: string) => {
    let name = shortName.split("-").pop() || "";
    name = name.replace(/Neural$/, "");
    return name.replace(/([A-Z])/g, " $1").trim(); // "AndrewMultilingual" -> "Andrew Multilingual"
  };

  return (
    <div
      className="rounded-2xl border flex flex-col overflow-hidden h-[500px]"
      style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}
    >
      <div className="flex flex-col gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--muted)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
            </svg>
            <h2 className="font-semibold text-sm">Voice Library</h2>
          </div>
          {loading ? (
            <span className="text-[11px] animate-pulse uppercase tracking-wider" style={{ color: "var(--muted)" }}>Loading…</span>
          ) : (
            <span className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{filtered.length} voices</span>
          )}
        </div>

        {/* Search & Filters */}
        <div className="flex gap-2 relative z-10 mt-1">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none border transition-all focus:border-[var(--accent)]"
            style={{ background: "var(--background)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
          />
          <div className="w-[125px] shrink-0">
            <LanguageSelector languages={languages} selected={langFilter} onSelect={setLangFilter} />
          </div>
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as any)}
            className="rounded-lg px-2 py-1.5 text-xs outline-none border cursor-pointer w-[100px] shrink-0 transition-all focus:border-[var(--accent)]"
            style={{ background: "var(--background)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
          >
            <option value="All">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>

      {/* Voice List */}
      <div className="flex-1 overflow-y-auto" style={{ background: "var(--surface)" }}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[52px] border-b animate-pulse" style={{ borderColor: "var(--card-border)", background: "rgba(255,255,255,0.02)" }} />
          ))
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--muted)" }}>No voices match your search.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filtered.map((voice) => {
              const isSelected = selected === voice.ShortName;
              const isPlaying = playingId === voice.ShortName;
              const isLoadingPreview = loadingPreviewId === voice.ShortName;
              const displayName = formatVoiceName(voice.ShortName);
              const localeName = voice.Locale.split("-")[1] || voice.Locale;

              const isFavorite = favorites.some((f: any) => f.id === voice.ShortName && f.provider === "edge");

              return (
                <div
                  key={voice.ShortName}
                  onClick={() => onSelect(voice.ShortName)}
                  className={`relative p-4 rounded-xl border flex flex-col gap-2 transition-colors hover:border-[var(--accent)] cursor-pointer ${
                    isSelected ? "bg-[var(--elevated)]" : "bg-[var(--surface)]"
                  }`}
                  style={{
                    borderColor: isSelected ? "var(--accent)" : "var(--card-border)",
                  }}
                >
                  {onToggleFavorite && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite({
                          id: voice.ShortName,
                          provider: "edge",
                          name: voice.FriendlyName || voice.ShortName,
                          subtitle: `${voice.Gender} • ${voice.Locale}`
                        });
                      }}
                      className={`absolute top-3 right-16 p-1.5 rounded-full transition-colors ${isFavorite ? "text-red-500 bg-red-500/10" : "text-[var(--muted)] hover:text-white hover:bg-white/10"}`}
                      title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      <svg width="14" height="14" fill={isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isFavorite ? 0 : 2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                    </button>
                  )}
                  <div className="flex justify-between items-start">
                    <h4 className={`font-bold pr-16 ${isSelected ? "text-[var(--accent)]" : ""}`}>{displayName}</h4>
                    <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded truncate ml-2 max-w-[60px] text-center">{localeName}</span>
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <p className="text-xs text-[var(--muted)]">Gender: {voice.Gender}</p>
                    <button 
                      onClick={(e) => handlePreview(e, voice)}
                      disabled={isLoadingPreview && !isPlaying}
                      className="px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 hover:bg-[var(--elevated)]"
                      style={{ borderColor: "var(--card-border)", color: isPlaying ? "var(--accent)" : "var(--foreground)" }}
                      title="Preview Voice"
                    >
                      {isLoadingPreview ? (
                        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                      ) : isPlaying ? (
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                      ) : (
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
