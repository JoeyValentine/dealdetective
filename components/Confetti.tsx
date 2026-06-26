"use client";

import { useEffect, useMemo, useState } from "react";

const EMOJIS = ["💰", "💵", "💴", "💶", "💷", "🪙", "💲", "¢", "🎟️", "🏷️"];

interface Piece {
  id: number;
  emoji: string;
  left: number;
  size: number;
  duration: number;
  delay: number;
}

interface ConfettiProps {
  messages: string[];
  onDone: () => void;
}

export default function Confetti({ messages, onDone }: ConfettiProps) {
  const [msgIdx, setMsgIdx] = useState(0);

  const pieces = useMemo<Piece[]>(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      emoji: EMOJIS[i % EMOJIS.length],
      left: Math.random() * 100,
      size: 1 + Math.random() * 1.8,
      duration: 2 + Math.random() * 2.5,
      delay: Math.random() * 1.5,
    }))
  , []);

  useEffect(() => {
    // Cycle through messages, then dismiss
    if (messages.length > 1) {
      const cycleTimer = setTimeout(() => setMsgIdx(1), 2000);
      const doneTimer = setTimeout(onDone, 4200);
      return () => { clearTimeout(cycleTimer); clearTimeout(doneTimer); };
    } else {
      const t = setTimeout(onDone, 3800);
      return () => clearTimeout(t);
    }
  }, [messages.length, onDone]);

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
          className="bg-[var(--card)]/95 backdrop-blur-md rounded-3xl px-8 py-6 shadow-2xl text-center border border-[var(--border)] max-w-sm mx-4"
          style={{ animation: "fadeInUp 0.4s ease-out both" }}
        >
          <p className="text-3xl mb-3">🎉</p>
          <p
            key={msgIdx}
            className="text-lg font-bold text-[var(--text-1)] leading-snug"
            style={{ animation: "fadeInUp 0.3s ease-out both" }}
          >
            {messages[msgIdx]}
          </p>
          {messages.length > 1 && msgIdx === 0 && (
            <p className="text-xs text-[var(--text-3)] mt-2">Scanning subscriptions…</p>
          )}
        </div>
      </div>
    </div>
  );
}
