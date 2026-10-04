"use client";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (val: number) => void;
  onReset: () => void;
}

function Slider({ label, value, min, max, step, displayValue, onChange, onReset }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium tracking-wide uppercase" style={{ color: "var(--muted)" }}>{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono" style={{ color: "var(--accent)" }}>{displayValue}</span>
          {value !== 0 && (
            <button
              onClick={onReset}
              className="text-[10px] ml-1 opacity-60 hover:opacity-100 transition-all cursor-pointer"
            >
              ↺
            </button>
          )}
        </div>
      </div>
      <div className="relative pt-1 pb-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1"
          style={{
            background: `linear-gradient(to right, var(--accent) ${pct}%, var(--card-border) ${pct}%)`,
          }}
        />
      </div>
    </div>
  );
}

export interface ControlValues {
  rate: number;
  pitch: number;
  volume: number;
}

interface ControlsPanelProps {
  controls: ControlValues;
  onChange: (controls: ControlValues) => void;
}

const DEFAULTS: ControlValues = { rate: 0, pitch: 0, volume: 0 };

export default function ControlsPanel({ controls, onChange }: ControlsPanelProps) {
  const set = (key: keyof ControlValues) => (val: number) =>
    onChange({ ...controls, [key]: val });
  const reset = (key: keyof ControlValues) => () =>
    onChange({ ...controls, [key]: DEFAULTS[key] });

  const formatRate = (v: number) => (v === 0 ? "1.0x" : v > 0 ? `+${v}%` : `${v}%`);
  const formatPitch = (v: number) => (v === 0 ? "0Hz" : v > 0 ? `+${v}Hz` : `${v}Hz`);
  const formatVol = (v: number) => (v === 0 ? "0dB" : v > 0 ? `+${v}%` : `${v}%`);

  return (
    <div
      className="rounded-2xl border flex flex-col overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--muted)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          <h2 className="font-semibold text-sm">Speech Controls</h2>
        </div>
        <button
          onClick={() => onChange(DEFAULTS)}
          className="text-[11px] transition-all hover:text-white cursor-pointer"
          style={{ color: "var(--muted)" }}
        >
          Reset All
        </button>
      </div>

      <div className="p-6 flex flex-col gap-6">
        <Slider label="Speed" value={controls.rate} min={-50} max={100} step={5} displayValue={formatRate(controls.rate)} onChange={set("rate")} onReset={reset("rate")} />
        <Slider label="Pitch" value={controls.pitch} min={-20} max={20} step={1} displayValue={formatPitch(controls.pitch)} onChange={set("pitch")} onReset={reset("pitch")} />
        <Slider label="Volume Boost" value={controls.volume} min={-50} max={100} step={5} displayValue={formatVol(controls.volume)} onChange={set("volume")} onReset={reset("volume")} />
      </div>
    </div>
  );
}
