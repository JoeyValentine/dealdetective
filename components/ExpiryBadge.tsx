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
      <span className="inline-flex items-center gap-1 text-xs text-[#AEAEB2] bg-[#F2F2F7] px-2.5 py-1 rounded-full">
        <Clock size={10} />
        Evergreen
      </span>
    );
  }

  const { label, color } = getExpiryCountdown(expirationDate);

  const styles = {
    green: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    red: "text-red-500 bg-red-50 font-medium",
    gray: "text-[#AEAEB2] bg-[#F2F2F7]",
  };

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${styles[color]}`}>
      <Clock size={10} />
      {label}
    </span>
  );
}
