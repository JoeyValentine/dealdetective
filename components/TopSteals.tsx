"use client";

import { Deal } from "@/types/deal";
import ExpiryBadge from "./ExpiryBadge";
import ConfidenceBadge from "./ConfidenceBadge";
import { Copy, Check, Zap, ExternalLink } from "lucide-react";
import { useState } from "react";

const TOP_COLOR: Record<string, { strip: string; codeRing: string; gradient: string }> = {
  blue:   { strip: "bg-blue-500",    codeRing: "bg-blue-50 dark:bg-blue-900/30 border-blue-200/60 dark:border-blue-700/40 text-blue-700 dark:text-blue-300",     gradient: "rgba(59,130,246,0.06)" },
  purple: { strip: "bg-purple-500",  codeRing: "bg-purple-50 dark:bg-purple-900/30 border-purple-200/60 dark:border-purple-700/40 text-purple-700 dark:text-purple-300", gradient: "rgba(139,92,246,0.06)" },
  green:  { strip: "bg-emerald-500", codeRing: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200/60 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300", gradient: "rgba(16,185,129,0.06)" },
  orange: { strip: "bg-orange-500",  codeRing: "bg-orange-50 dark:bg-orange-900/30 border-orange-200/60 dark:border-orange-700/40 text-orange-700 dark:text-orange-300", gradient: "rgba(249,115,22,0.06)" },
  teal:   { strip: "bg-teal-500",    codeRing: "bg-teal-50 dark:bg-teal-900/30 border-teal-200/60 dark:border-teal-700/40 text-teal-700 dark:text-teal-300",     gradient: "rgba(20,184,166,0.06)" },
  yellow: { strip: "bg-yellow-400",  codeRing: "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200/60 dark:border-yellow-700/40 text-yellow-700 dark:text-yellow-300", gradient: "rgba(234,179,8,0.06)" },
};

function formatDiscount(deal: Deal): string {
  if (deal.offerType === "bogo") return "BOGO";
  if (deal.offerType === "free_shipping") return "Free Ship";
  if (deal.offerType === "freebie") return "FREE";
  return `${deal.effectiveDiscountPercent}%`;
}

function StealCard({ deal, rank }: { deal: Deal; rank: number }) {
  const [copied, setCopied] = useState(false);
  const { strip, codeRing, gradient } = TOP_COLOR[deal.dealColor] || TOP_COLOR.blue;

  function copyCode() {
    if (!deal.promoCode) return;
    navigator.clipboard.writeText(deal.promoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="rounded-[20px] overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1"
      style={{
        background: `linear-gradient(150deg, ${gradient} 0%, var(--card) 50%)`,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Colored top strip */}
      <div className={`h-1 ${strip}`} />

      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Rank + discount */}
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-3)] text-xs font-medium">#{rank}</span>
          <span className="text-amber-500 font-bold text-xl leading-none">{formatDiscount(deal)}</span>
        </div>

        {/* Retailer + notes */}
        <div>
          <p className="text-[var(--text-1)] font-bold text-sm leading-tight">{deal.retailer}</p>
          <p className="text-[var(--text-3)] text-xs mt-0.5">{deal.category}</p>
          {deal.notes && deal.notes !== "No expiry detected" && (
            <p className="text-[var(--text-3)] text-xs mt-1 leading-snug line-clamp-2 italic">{deal.notes}</p>
          )}
        </div>

        {/* Promo code */}
        {deal.promoCode ? (
          <button
            onClick={copyCode}
            className={`flex items-center justify-between gap-1.5 border rounded-xl px-3 py-2 text-left transition-opacity hover:opacity-80 ${codeRing}`}
          >
            <code className="font-mono text-xs tracking-widest flex-1 truncate">{deal.promoCode}</code>
            {copied
              ? <Check size={12} className="text-emerald-500 shrink-0" />
              : <Copy size={12} className="opacity-50 shrink-0" />
            }
          </button>
        ) : (
          <div className="bg-[var(--surface)] rounded-xl px-3 py-2">
            <span className="text-[var(--text-3)] text-xs">No code needed</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1.5 flex-wrap mt-auto">
          <ExpiryBadge expirationDate={deal.expirationDate} expirationStatus={deal.expirationStatus} />
          <ConfidenceBadge score={deal.confidenceScore} />
        </div>

        {/* Gmail link */}
        {deal.sourceEmail.messageId && (
          <a
            href={`https://mail.google.com/mail/u/0/#inbox/${deal.sourceEmail.messageId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--text-3)] hover:text-amber-500 transition-colors"
          >
            <ExternalLink size={9} />
            View in Gmail
          </a>
        )}
      </div>
    </div>
  );
}

interface TopStealsProps {
  deals: Deal[];
}

export default function TopSteals({ deals }: TopStealsProps) {
  if (deals.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
          <Zap size={15} className="text-amber-500" />
        </div>
        <h2 className="text-[var(--text-1)] font-semibold text-lg">Top 10 Steals</h2>
        <span className="text-[var(--text-3)] text-sm font-normal">best active discounts</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {deals.slice(0, 10).map((deal, i) => (
          <StealCard key={deal.id} deal={deal} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
