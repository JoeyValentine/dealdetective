"use client";

import { useEffect, useMemo } from "react";

const EMOJIS = ["💰", "💵", "🪙", "💸", "🎟️"];

interface Piece {
  id: number;
  emoji: string;
  left: number;
  size: number;
  duration: number;
  delay: number;
}

interface ConfettiProps {
  message: string;
  onDone: () => void;
}

export default function Confetti({ message, onDone }: ConfettiProps) {
  const pieces = useMemo<Piece[]>(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i,
      emoji: EMOJIS[i % EMOJIS.length],
      left: Math.random() * 100,
      size: 1.2 + Math.random() * 1.6,
      duration: 2.2 + Math.random() * 2,
      delay: Math.random() * 1.2,
    }))
  , []);

  useEffect(() => {
    const t = setTimeout(onDone, 3800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute select-none"
          style={{
            top: "-2rem",
            left: `${p.left}%`,
            fontSize: `${p.size}rem`,
            animation: `rain ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        >
          {p.emoji}
        </span>
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="bg-[var(--card)]/95 backdrop-blur-md rounded-3xl px-8 py-6 shadow-2xl text-center border border-[var(--border)]"
          style={{ animation: "fadeInUp 0.4s ease-out both, fadeOut 0.5s 3.2s ease-in forwards" }}
        >
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-xl font-bold text-[var(--text-1)] mb-1">{message}</p>
          <p className="text-sm text-[var(--text-3)]">Ranked by urgency & discount quality</p>
        </div>
      </div>
    </div>
  );
}
