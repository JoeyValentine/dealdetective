"use client";

import { Deal } from "@/types/deal";
import ExpiryBadge from "./ExpiryBadge";
import ConfidenceBadge from "./ConfidenceBadge";
import { Copy, Check, AlertTriangle, ImageIcon, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";

const DEAL_COLORS: Record<string, { borderColor: string; badge: string; label: string; gradient: string }> = {
  blue:   { borderColor: "#3B82F6", badge: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",   label: "% Off",    gradient: "rgba(59,130,246,0.06)" },
  purple: { borderColor: "#8B5CF6", badge: "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400", label: "Half Off+", gradient: "rgba(139,92,246,0.06)" },
  green:  { borderColor: "#10B981", badge: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", label: "BOGO",    gradient: "rgba(16,185,129,0.06)" },
  orange: { borderColor: "#F97316", badge: "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400", label: "$ Off",    gradient: "rgba(249,115,22,0.06)" },
  teal:   { borderColor: "#14B8A6", badge: "bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400",   label: "Free",     gradient: "rgba(20,184,166,0.06)" },
  yellow: { borderColor: "#EAB308", badge: "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400", label: "Sale",    gradient: "rgba(234,179,8,0.06)" },
};

function formatDiscount(deal: Deal): string {
  if (deal.offerType === "bogo") return "BOGO";
  if (deal.offerType === "free_shipping") return "Free Shipping";
  if (deal.offerType === "freebie") return "Free Item";
  if (deal.discountUnit === "percent") return `${deal.discountValue}% Off`;
  if (deal.discountUnit === "dollars") return `$${deal.discountValue} Off`;
  return "Deal";
}

interface DealCardProps {
  deal: Deal;
  compact?: boolean;
}

export default function DealCard({ deal, compact = false }: DealCardProps) {
  const [copied, setCopied] = useState(false);
  const colors = DEAL_COLORS[deal.dealColor] || DEAL_COLORS.blue;
  const isUrgent = deal.urgency === "urgent";

  function copyCode() {
    if (!deal.promoCode) return;
    navigator.clipboard.writeText(deal.promoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        borderLeft: `3px solid ${colors.borderColor}`,
        background: `linear-gradient(135deg, ${colors.gradient} 0%, var(--card) 55%)`,
        boxShadow: isUrgent
          ? "0 2px 14px rgba(239,68,68,0.14), 0 1px 4px rgba(0,0,0,0.06)"
          : "var(--shadow-card)",
      }}
      className={`
        relative rounded-[20px] transition-all duration-200
        hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1
        ${compact ? "p-4" : "p-5"}
      `}
    >
      {/* Urgent pulsing dot */}
      {isUrgent && (
        <span className="absolute top-4 right-4 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${colors.badge}`}>
            {colors.label}
          </span>
          <span className="font-bold text-[var(--text-1)] text-base truncate leading-tight">{deal.retailer}</span>
        </div>
        <span className="text-amber-500 font-bold text-base shrink-0 leading-tight">{formatDiscount(deal)}</span>
      </div>

      {/* Promo code pill */}
      {deal.promoCode && (
        <button
          onClick={copyCode}
          className="w-full flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 rounded-2xl px-4 py-2.5 mb-3 hover:bg-amber-100/70 dark:hover:bg-amber-900/30 transition-colors group/code text-left"
        >
          <code className="font-mono text-amber-700 dark:text-amber-400 text-sm tracking-widest">{deal.promoCode}</code>
          {copied
            ? <Check size={13} className="text-emerald-500 shrink-0" />
            : <Copy size={13} className="text-amber-400 group-hover/code:text-amber-600 shrink-0 transition-colors" />
          }
        </button>
      )}

      {/* Code in image notice */}
      {deal.codeInImage && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2 mb-3">
          <ImageIcon size={11} />
          Code may be in image — open email to view
        </div>
      )}

      {!compact && (
        <>
          {deal.notes && deal.notes !== "No expiry detected" && (
            <p className="text-xs text-[var(--text-2)] mb-2 leading-relaxed italic">{deal.notes}</p>
          )}
          {deal.restrictions && (
            <p className="text-xs text-[var(--text-2)] mb-2.5 leading-relaxed">{deal.restrictions}</p>
          )}
          {deal.minimumSpend && (
            <p className="text-xs text-[var(--text-3)] mb-2.5">Min. spend: ${deal.minimumSpend}</p>
          )}
        </>
      )}

      {/* Footer badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <ExpiryBadge expirationDate={deal.expirationDate} expirationStatus={deal.expirationStatus} />
        <ConfidenceBadge score={deal.confidenceScore} />
        <span className="text-[10px] font-semibold text-amber-500/70 tabular-nums">★{deal.qualityScore}</span>
        {deal.repeatFrequency && (
          <span className="inline-flex items-center gap-1 text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 px-2.5 py-1 rounded-full">
            <RefreshCw size={9} />
            {deal.repeatFrequency}
          </span>
        )}
        {deal.confidenceScore === "low" && (
          <span className="inline-flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle size={10} />
            Treat with caution
          </span>
        )}
      </div>

      {/* Category + Gmail link */}
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-[var(--text-3)]">{deal.category}</p>
        {deal.sourceEmail.messageId && (
          <a
            href={`https://mail.google.com/mail/u/0/#inbox/${deal.sourceEmail.messageId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--text-3)] hover:text-amber-500 transition-colors"
          >
            <ExternalLink size={10} />
            Gmail
          </a>
        )}
      </div>
    </div>
  );
}
