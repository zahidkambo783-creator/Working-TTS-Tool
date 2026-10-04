"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface TtsControls {
  voice: string;
  rate: number;   // 0.1 – 10
  pitch: number;  // 0 – 2
  volume: number; // 0 – 1
}

interface UseBrowserTtsReturn {
  speak: (text: string, controls: TtsControls) => void;
  stop: () => void;
  speaking: boolean;
  supported: boolean;
  browserVoices: SpeechSynthesisVoice[];
}

export function useBrowserTts(): UseBrowserTtsReturn {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    setSupported(true);

    const loadVoices = () => {
      const v = synth.getVoices();
      if (v.length) setBrowserVoices(v);
    };

    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    return () => synth.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string, controls: TtsControls) => {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    // Match voice by name (ShortName or Name)
    const voices = window.speechSynthesis.getVoices();
    const matched = voices.find(
      (v) =>
        v.name === controls.voice ||
        v.name.includes(controls.voice) ||
        controls.voice.includes(v.name.split(" ")[0])
    );
    if (matched) utter.voice = matched;

    utter.rate = controls.rate;
    utter.pitch = controls.pitch;
    utter.volume = controls.volume;

    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);

    uttRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [supported]);

  return { speak, stop, speaking, supported, browserVoices };
}
