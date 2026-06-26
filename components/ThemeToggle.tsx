"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      className="p-2 bg-[var(--surface)] rounded-xl hover:opacity-80 transition-opacity"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark
        ? <Sun size={15} className="text-amber-400" />
        : <Moon size={15} className="text-[var(--text-3)]" />
      }
    </button>
  );
}
