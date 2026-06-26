"use client";

import { getExpiryCountdown } from "@/lib/ranker";
import { Clock } from "lucide-react";

interface ExpiryBadgeProps {
  expirationDate: string | null;
  expirationStatus: string;
}

export default function ExpiryBadge({ expirationDate, expirationStatus }: ExpiryBadgeProps) {
  if (expirationStatus === "no_expiry") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--text-3)] bg-[var(--surface)] px-2.5 py-1 rounded-full">
        <Clock size={10} />
        No expiry
      </span>
    );
  }

  const { label, color } = getExpiryCountdown(expirationDate);

  const styles = {
    green: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30",
    red: "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 font-medium",
    gray: "text-[var(--text-3)] bg-[var(--surface)]",
  };

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${styles[color]}`}>
      <Clock size={10} />
      {label}
    </span>
  );
}
