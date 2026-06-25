"use client";

import { Deal } from "@/types/deal";
import ExpiryBadge from "./ExpiryBadge";
import ConfidenceBadge from "./ConfidenceBadge";
import { Copy, Check, Zap } from "lucide-react";
import { useState } from "react";

const TOP_COLOR: Record<string, { strip: string; codeRing: string }> = {
  blue: { strip: "bg-blue-500", codeRing: "bg-blue-50 border-blue-200/60 text-blue-700" },
  purple: { strip: "bg-purple-500", codeRing: "bg-purple-50 border-purple-200/60 text-purple-700" },
  green: { strip: "bg-emerald-500", codeRing: "bg-emerald-50 border-emerald-200/60 text-emerald-700" },
  orange: { strip: "bg-orange-500", codeRing: "bg-orange-50 border-orange-200/60 text-orange-700" },
  teal: { strip: "bg-teal-500", codeRing: "bg-teal-50 border-teal-200/60 text-teal-700" },
  yellow: { strip: "bg-yellow-400", codeRing: "bg-yellow-50 border-yellow-200/60 text-yellow-700" },
};

function formatDiscount(deal: Deal): string {
  if (deal.offerType === "bogo") return "BOGO";
  if (deal.offerType === "free_shipping") return "Free Ship";
  if (deal.offerType === "freebie") return "FREE";
  if (deal.discountUnit === "percent") return `${deal.discountValue}%`;
  if (deal.discountUnit === "dollars") return `$${deal.discountValue}`;
  return "Deal";
}

function StealCard({ deal, rank }: { deal: Deal; rank: number }) {
  const [copied, setCopied] = useState(false);
  const { strip, codeRing } = TOP_COLOR[deal.dealColor] || TOP_COLOR.blue;

  function copyCode() {
    if (!deal.promoCode) return;
    navigator.clipboard.writeText(deal.promoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="bg-white rounded-[20px] overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5"
      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Colored top strip */}
      <div className={`h-1 ${strip}`} />

      <div className="p-4 flex flex-col gap-2.5 flex-1">
        {/* Rank + discount */}
        <div className="flex items-center justify-between">
          <span className="text-[#AEAEB2] text-xs font-medium">#{rank}</span>
          <span className="text-amber-500 font-bold text-xl leading-none">{formatDiscount(deal)}</span>
        </div>

        {/* Retailer */}
        <div>
          <p className="text-[#1C1C1E] font-semibold text-sm leading-tight">{deal.retailer}</p>
          <p className="text-[#AEAEB2] text-xs mt-0.5 leading-tight">{deal.category}</p>
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
          <div className="bg-[#F2F2F7] rounded-xl px-3 py-2">
            <span className="text-[#AEAEB2] text-xs">No code needed</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1.5 flex-wrap mt-auto">
          <ExpiryBadge expirationDate={deal.expirationDate} expirationStatus={deal.expirationStatus} />
          <ConfidenceBadge score={deal.confidenceScore} />
        </div>
      </div>
    </div>
  );
}

interface TopStealsProps {
  deals: Deal[];
}

export default function TopSteals({ deals }: TopStealsProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-amber-50 rounded-xl">
          <Zap size={15} className="text-amber-500" />
        </div>
        <h2 className="text-[#1C1C1E] font-semibold text-lg">Top 10 Steals</h2>
        <span className="text-[#AEAEB2] text-sm font-normal">best active discounts</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {deals.slice(0, 10).map((deal, i) => (
          <StealCard key={deal.id} deal={deal} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
