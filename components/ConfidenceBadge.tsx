"use client";

import { ConfidenceScore } from "@/types/deal";
import { ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";

interface ConfidenceBadgeProps {
  score: ConfidenceScore;
}

export default function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const config = {
    high: {
      label: "Verified",
      icon: ShieldCheck,
      className: "text-emerald-600 bg-emerald-50",
    },
    medium: {
      label: "Verify at checkout",
      icon: ShieldAlert,
      className: "text-amber-600 bg-amber-50",
    },
    low: {
      label: "Unverified",
      icon: ShieldOff,
      className: "text-red-500 bg-red-50",
    },
  };

  const { label, icon: Icon, className } = config[score];

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${className}`}>
      <Icon size={10} />
      {label}
    </span>
  );
}
