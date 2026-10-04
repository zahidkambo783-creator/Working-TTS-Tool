"use client";

import { useState, useMemo, useRef, useEffect } from "react";

interface LanguageSelectorProps {
  languages: string[]; // e.g. ["All", "EN", "ZH", "ES", ...]
  selected: string;
  onSelect: (lang: string) => void;
}

const REGION_MAP: Record<string, string> = {
  EN: "Americas, Europe", ES: "Americas, Europe", FR: "Europe, Africa", PT: "Americas, Europe",
  ZH: "Asia", JA: "Asia", KO: "Asia", HI: "Asia", VI: "Asia", TH: "Asia", ID: "Asia", MS: "Asia", BN: "Asia",
  DE: "Europe", IT: "Europe", RU: "Europe, Asia", NL: "Europe", PL: "Europe", UK: "Europe", RO: "Europe", 
  SV: "Europe", FI: "Europe", DA: "Europe", NO: "Europe", CS: "Europe", EL: "Europe", HU: "Europe",
  AR: "Middle East", TR: "Middle East", HE: "Middle East", FA: "Middle East", UR: "Middle East",
  SW: "Africa", AM: "Africa", ZU: "Africa",
};

const FLAG_MAP: Record<string, string> = {
  AF: "🇿🇦", AM: "🇦🇲", AR: "🇦🇪", AS: "🇮🇳", AST: "🇪🇸", AZ: "🇦🇿", BE: "🇧🇾", BG: "🇧🇬", BN: "🇮🇳", CS: "🇨🇿", 
  DA: "🇩🇰", DE: "🇩🇪", EL: "🇬🇷", EN: "🇺🇸", ES: "🇪🇸", ET: "🇪🇪", FA: "🇮🇷", 
  FI: "🇫🇮", FR: "🇫🇷", HE: "🇮🇱", HI: "🇮🇳", HR: "🇭🇷", HU: "🇭🇺", ID: "🇮🇩", 
  IT: "🇮🇹", JA: "🇯🇵", KO: "🇰🇷", LT: "🇱🇹", LV: "🇱🇻", MS: "🇲🇾", NL: "🇳🇱", 
  NO: "🇳🇴", PL: "🇵🇱", PT: "🇧🇷", RO: "🇷🇴", RU: "🇷🇺", SK: "🇸🇰", SL: "🇸🇮", 
  SV: "🇸🇪", SW: "🇰🇪", TA: "🇮🇳", TE: "🇮🇳", TH: "🇹🇭", TR: "🇹🇷", UK: "🇺🇦", 
  UR: "🇵🇰", VI: "🇻🇳", ZH: "🇨🇳", ZU: "🇿🇦",
};

const POPULAR_LANGS = ["EN", "ZH", "ES", "HI", "AR", "FR", "RU", "DE", "JA", "PT", "IT", "KO"];
const REGIONS = ["All", "Popular", "Asia", "Europe", "Middle East", "Americas", "Africa"];

export default function LanguageSelector({ languages, selected, onSelect }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Enrich language data
  const enrichedLanguages = useMemo(() => {
    const actualLangs = languages.filter(l => l !== "All");
    let enNames: Intl.DisplayNames | null = null;
    try { enNames = new Intl.DisplayNames(['en'], { type: 'language' }); } catch (e) {}

    return actualLangs.map(code => {
      let name = code;
      try {
        if (enNames) name = enNames.of(code.toLowerCase()) || code;
      } catch (e) {}

      return {
        code,
        name,
        region: REGION_MAP[code] || "Other",
        isPopular: POPULAR_LANGS.includes(code),
        flag: FLAG_MAP[code] || "🌐",
      };
    });
  }, [languages]);

  // Filtered list
  const filtered = useMemo(() => {
    return enrichedLanguages.filter(lang => {
      const matchesSearch = search === "" || 
        lang.name.toLowerCase().includes(search.toLowerCase()) ||
        lang.code.toLowerCase().includes(search.toLowerCase());

      let matchesTab = true;
      if (activeTab === "Popular") matchesTab = lang.isPopular;
      else if (activeTab !== "All") matchesTab = lang.region.includes(activeTab);

      return matchesSearch && matchesTab;
    });
  }, [enrichedLanguages, search, activeTab]);

  const selectedData = enrichedLanguages.find(l => l.code === selected);

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-xs border transition-all cursor-pointer"
        style={{
          background: "var(--background)",
          borderColor: isOpen ? "var(--accent)" : "var(--card-border)",
          color: "var(--foreground)",
          boxShadow: isOpen ? "0 0 0 2px var(--accent-glow)" : "none",
        }}
        title={selected === "All" ? "All Languages" : (selectedData?.name || selected)}
      >
        <span className="font-medium truncate pr-2">
          {selected === "All" ? "All Languages" : (selectedData?.name || selected)}
        </span>
        <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "0.2s", flexShrink: 0 }}>
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>

      {/* Popover */}
      {isOpen && (
        <div 
          className="absolute z-50 top-full left-0 mt-2 rounded-2xl border shadow-2xl flex flex-col overflow-hidden w-[260px]"
          style={{
            background: "var(--surface)",
            borderColor: "var(--card-border)",
            maxHeight: "400px",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {/* Search Bar */}
          <div className="p-2 border-b" style={{ borderColor: "var(--card-border)" }}>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="14" height="14" fill="none" stroke="var(--muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 1.65a7.5 7.5 0 010 15z" />
              </svg>
              <input
                type="text"
                placeholder="Search languages"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none bg-transparent transition-all"
                style={{
                  color: "var(--foreground)",
                }}
              />
            </div>
          </div>

          {/* Language List */}
          <div className="overflow-y-auto p-1 flex flex-col flex-1" style={{ background: "var(--background)" }}>
            <button
              onClick={() => { onSelect("All"); setIsOpen(false); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
              style={{
                background: selected === "All" ? "var(--elevated)" : "transparent",
              }}
            >
              <span className="text-base w-6 text-center">🌐</span>
              <span className="font-medium text-sm flex-1 text-left" style={{ color: "var(--foreground)" }}>All Languages</span>
              {selected === "All" && (
                <svg width="14" height="14" fill="var(--accent)" viewBox="0 0 24 24" className="shrink-0">
                  <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                </svg>
              )}
            </button>

            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
                No languages found
              </div>
            ) : (
              filtered.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => { onSelect(lang.code); setIsOpen(false); }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-[var(--elevated)]"
                  style={{
                    background: selected === lang.code ? "var(--elevated)" : "transparent",
                  }}
                >
                  <span className="text-base w-6 text-center">{lang.flag}</span>
                  <span className="font-medium text-sm flex-1 text-left truncate" style={{ color: "var(--foreground)" }}>
                    {lang.name}
                  </span>
                  {selected === lang.code && (
                    <svg width="14" height="14" fill="var(--accent)" viewBox="0 0 24 24" className="shrink-0">
                      <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
