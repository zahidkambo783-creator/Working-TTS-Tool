"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light") {
      setDark(false);
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      setDark(true);
      document.documentElement.removeAttribute("data-theme");
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <button
      onClick={toggle}
      className="relative w-14 h-7 rounded-full border transition-all cursor-pointer flex items-center px-1"
      style={{
        background: dark ? "var(--accent)" : "var(--card-border)",
        borderColor: "transparent",
      }}
      aria-label="Toggle theme"
    >
      <div
        className="w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center text-xs"
        style={{
          background: "#fff",
          transform: dark ? "translateX(28px)" : "translateX(0px)",
        }}
      >
        {dark ? "🌙" : "☀️"}
      </div>
    </button>
  );
}
