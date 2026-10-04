"use client";

interface TextPanelProps {
  text: string;
  onChange: (value: string) => void;
}

export default function TextPanel({ text, onChange }: TextPanelProps) {
  return (
    <div
      className="rounded-2xl border flex flex-col overflow-hidden transition-all focus-within:ring-1 focus-within:ring-[var(--accent)]"
      style={{
        background: "var(--surface)",
        borderColor: "var(--card-border)",
      }}
    >
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--card-border)", background: "var(--elevated)" }}>
        <div className="flex items-center gap-3 w-1/2">
          <div className="w-7 h-7 rounded flex items-center justify-center bg-[var(--accent-glow)] text-[var(--accent)] shrink-0">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Text to Speech" 
            className="bg-transparent font-bold text-base tracking-wide outline-none w-full"
            style={{ color: "var(--foreground)" }}
          />
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--muted)" }}>
          <div className="flex items-center gap-2">
             <button className="hover:text-[var(--foreground)] transition-colors"><b>B</b></button>
             <button className="hover:text-[var(--foreground)] transition-colors"><i>I</i></button>
             <button className="hover:text-[var(--foreground)] transition-colors"><u>U</u></button>
          </div>
          <span>{text.length.toLocaleString()} chars</span>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        placeholder="Start writing your script here..."
        className="w-full resize-y px-6 py-5 text-base leading-relaxed outline-none transition-all placeholder:opacity-40"
        style={{
          background: "transparent",
          color: "var(--foreground)",
          minHeight: "240px",
        }}
      />

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--card-border)", background: "var(--surface)" }}>
        {[
          "Hello! Welcome to ZK Voice Studio.",
          "The quick brown fox jumps over the lazy dog.",
          "In a world full of noise, your voice matters most.",
        ].map((sample) => (
          <button
            key={sample}
            onClick={() => onChange(sample)}
            className="text-[11px] px-3 py-1.5 rounded-md border transition-all hover:bg-[var(--elevated)] cursor-pointer"
            style={{
              borderColor: "var(--card-border)",
              color: "var(--muted)",
            }}
          >
            {sample.length > 30 ? sample.slice(0, 30) + "…" : sample}
          </button>
        ))}
        {text && (
          <button
            onClick={() => onChange("")}
            className="text-[11px] px-3 py-1.5 rounded-md transition-all hover:text-white cursor-pointer ml-auto"
            style={{ color: "var(--muted)" }}
          >
            Clear Editor
          </button>
        )}
      </div>
    </div>
  );
}
