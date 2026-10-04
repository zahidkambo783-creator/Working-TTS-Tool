"use client";

interface HistoryItem {
  id: string;
  text: string;
  voice: string;
  audioUrl: string;
  createdAt: Date;
}

interface HistoryPanelProps {
  items: HistoryItem[];
  onPlay: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export type { HistoryItem };

export default function HistoryPanel({
  items,
  onPlay,
  onRemove,
  onClearAll,
}: HistoryPanelProps) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-2xl border flex flex-col items-center justify-center p-12 text-center h-full min-h-[300px]"
        style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}
      >
        <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center border" style={{ background: "var(--background)", borderColor: "var(--card-border)", color: "var(--muted)" }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="font-semibold text-sm mb-1">Library Empty</h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>Your generated audio clips will be saved here.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border flex flex-col overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--muted)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          <h2 className="font-semibold text-sm">Generated Audio</h2>
        </div>
        <button
          onClick={onClearAll}
          className="text-[11px] transition-all hover:text-white cursor-pointer"
          style={{ color: "var(--muted)" }}
        >
          Clear History
        </button>
      </div>

      <div className="flex flex-col overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-4 px-5 py-3 border-b transition-colors hover:bg-[var(--elevated)]"
            style={{ borderColor: "var(--card-border)" }}
          >
            {/* Play button */}
            <button
              onClick={() => onPlay(item)}
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all border shadow-sm group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]"
              style={{ background: "var(--background)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
            >
              <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24" className="ml-0.5">
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                {item.text}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: "var(--muted)" }}>
                <span className="px-1.5 py-0.5 rounded-sm" style={{ background: "rgba(255,255,255,0.05)" }}>{item.voice}</span>
                <span>
                  {item.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <a
                href={item.audioUrl}
                download={`zk-voice-${item.id}.mp3`}
                className="transition-all hover:text-white cursor-pointer"
                style={{ color: "var(--muted)" }}
                title="Download MP3"
              >
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </a>
              <button
                onClick={() => onRemove(item.id)}
                className="transition-all hover:text-white cursor-pointer"
                style={{ color: "var(--muted)" }}
                title="Delete"
              >
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
