"use client";

import { Deal } from "@/types/deal";
import ExpiryBadge from "./ExpiryBadge";
import ConfidenceBadge from "./ConfidenceBadge";
import { Copy, Check, AlertTriangle, ImageIcon, ExternalLink } from "lucide-react";
import { useState } from "react";

const DEAL_COLORS: Record<
  string,
  { borderColor: string; badge: string; label: string }
> = {
  blue: {
    borderColor: "#3B82F6",
    badge: "bg-blue-50 text-blue-600",
    label: "% Off",
  },
  purple: {
    borderColor: "#8B5CF6",
    badge: "bg-purple-50 text-purple-600",
    label: "Half Off+",
  },
  green: {
    borderColor: "#10B981",
    badge: "bg-emerald-50 text-emerald-600",
    label: "BOGO",
  },
  orange: {
    borderColor: "#F97316",
    badge: "bg-orange-50 text-orange-600",
    label: "$ Off",
  },
  teal: {
    borderColor: "#14B8A6",
    badge: "bg-teal-50 text-teal-600",
    label: "Free",
  },
  yellow: {
    borderColor: "#EAB308",
    badge: "bg-yellow-50 text-yellow-700",
    label: "Sale",
  },
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
        boxShadow: isUrgent
          ? "0 2px 14px rgba(239,68,68,0.12), 0 1px 4px rgba(0,0,0,0.06)"
          : "0 2px 14px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
      }}
      className={`
        relative bg-white rounded-[20px] transition-all duration-200
        hover:shadow-[0_6px_24px_rgba(0,0,0,0.1)] hover:-translate-y-px
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
          <span className="font-semibold text-[#1C1C1E] text-sm truncate">{deal.retailer}</span>
        </div>
        <span className="text-amber-500 font-bold text-sm shrink-0">{formatDiscount(deal)}</span>
      </div>

      {/* Promo code pill */}
      {deal.promoCode && (
        <button
          onClick={copyCode}
          className="w-full flex items-center justify-between gap-2 bg-amber-50 border border-amber-200/60 rounded-2xl px-4 py-2.5 mb-3 hover:bg-amber-100/70 transition-colors group/code text-left"
        >
          <code className="font-mono text-amber-700 text-sm tracking-widest">{deal.promoCode}</code>
          {copied ? (
            <Check size={13} className="text-emerald-500 shrink-0" />
          ) : (
            <Copy size={13} className="text-amber-400 group-hover/code:text-amber-600 shrink-0 transition-colors" />
          )}
        </button>
      )}

      {/* Code in image notice */}
      {deal.codeInImage && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mb-3">
          <ImageIcon size={11} />
          Code may be in image — open email to view
        </div>
      )}

      {!compact && (
        <>
          {deal.notes && deal.notes !== "No expiry detected" && (
            <p className="text-xs text-[#6C6C70] mb-2 leading-relaxed italic">{deal.notes}</p>
          )}
          {deal.restrictions && (
            <p className="text-xs text-[#6C6C70] mb-2.5 leading-relaxed">{deal.restrictions}</p>
          )}
          {deal.minimumSpend && (
            <p className="text-xs text-[#AEAEB2] mb-2.5">Min. spend: ${deal.minimumSpend}</p>
          )}
        </>
      )}

      {/* Footer badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <ExpiryBadge expirationDate={deal.expirationDate} expirationStatus={deal.expirationStatus} />
        <ConfidenceBadge score={deal.confidenceScore} />
        {deal.confidenceScore === "low" && (
          <span className="inline-flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle size={10} />
            Treat with caution
          </span>
        )}
      </div>

      {/* Category + Gmail link */}
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-[#AEAEB2]">{deal.category}</p>
        {deal.sourceEmail.messageId && (
          <a
            href={`https://mail.google.com/mail/u/0/#inbox/${deal.sourceEmail.messageId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#AEAEB2] hover:text-amber-500 transition-colors"
          >
            <ExternalLink size={10} />
            Gmail
          </a>
        )}
      </div>
    </div>
  );
}
