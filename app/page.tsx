"use client";

import { useState, useMemo } from "react";
import { rankDeals, searchDeals } from "@/lib/ranker";
import { Category, Deal } from "@/types/deal";
import DealCard from "@/components/DealCard";
import TopSteals from "@/components/TopSteals";
import CategoryTabs from "@/components/CategoryTabs";
import SearchBar from "@/components/SearchBar";
import StatsBar from "@/components/StatsBar";
import GmailConnect from "@/components/GmailConnect";
import { Bell, Radar, ChevronDown, ChevronUp, Package } from "lucide-react";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExpiring, setShowExpiring] = useState(true);
  const [showEvergreen, setShowEvergreen] = useState(false);
  const [minDiscount, setMinDiscount] = useState(0);
  const [realDeals, setRealDeals] = useState<Deal[]>([]);

  const allActive = useMemo(() => realDeals, [realDeals]);

  const stats = useMemo(() => {
    const cats = new Set(realDeals.map((d) => d.category));
    const estimatedSavings = realDeals.reduce((sum, d) => {
      if (d.discountUnit === "percent") return sum + d.discountValue * 5;
      if (d.discountUnit === "dollars") return sum + d.discountValue;
      return sum + 25;
    }, 0);
    return {
      totalActive: realDeals.length,
      expiringToday: realDeals.filter((d) => d.urgency === "urgent").length,
      categoriesCount: cats.size,
      estimatedSavings: Math.round(estimatedSavings),
    };
  }, [realDeals]);

  const top10 = useMemo(
    () => allActive
      .filter((d) => d.urgency !== "evergreen" && d.expirationStatus !== "expired")
      .sort((a, b) => b.effectiveDiscountPercent - a.effectiveDiscountPercent)
      .slice(0, 10),
    [allActive]
  );

  const evergreen = useMemo(
    () => allActive.filter((d) => d.urgency === "evergreen"),
    [allActive]
  );

  const expiringDeals = useMemo(
    () => allActive.filter((d) => d.urgency === "urgent"),
    [allActive]
  );

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<Category | "All", number>> = {};
    counts["All"] = allActive.filter((d) => d.urgency !== "evergreen").length;
    allActive.filter((d) => d.urgency !== "evergreen").forEach((d) => {
      counts[d.category] = (counts[d.category] || 0) + 1;
    });
    return counts;
  }, [allActive]);

  const filteredDeals = useMemo(() => {
    let deals = allActive.filter((d) => d.urgency !== "evergreen");
    if (activeCategory !== "All") deals = deals.filter((d) => d.category === activeCategory);
    if (searchQuery) deals = searchDeals(deals, searchQuery);
    if (minDiscount > 0) deals = deals.filter((d) => d.effectiveDiscountPercent >= minDiscount);
    return rankDeals(deals);
  }, [allActive, activeCategory, searchQuery, minDiscount]);

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Header */}
      <header
        className="bg-white/90 backdrop-blur-md sticky top-0 z-40"
        style={{ borderBottom: "1px solid rgba(60,60,67,0.1)", boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="bg-amber-50 rounded-2xl p-2">
              <Radar size={17} className="text-amber-500" />
            </div>
            <div>
              <h1 className="font-semibold text-[#1C1C1E] text-sm leading-none">DealDetective</h1>
              <p className="text-[#AEAEB2] text-[11px] leading-none mt-0.5 font-medium">Promo Intel</p>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-lg">
            <SearchBar onSearch={setSearchQuery} placeholder="Search brands, categories, codes…" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <button className="relative p-2 bg-[#F2F2F7] rounded-xl hover:bg-[#E5E5EA] transition-colors">
              <Bell size={15} className="text-[#6C6C70]" />
              {expiringDeals.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                  {expiringDeals.length}
                </span>
              )}
            </button>
            <GmailConnect onSyncComplete={setRealDeals} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-7">
        {/* Stats */}
        <StatsBar stats={stats} />

        {/* Expiring Soon */}
        {expiringDeals.length > 0 && (
          <div
            className="bg-white rounded-[20px] overflow-hidden"
            style={{ boxShadow: "0 2px 12px rgba(239,68,68,0.08), 0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <button
              onClick={() => setShowExpiring(!showExpiring)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-red-50/40 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="text-red-500 font-semibold text-sm">
                  {expiringDeals.length} deal{expiringDeals.length !== 1 ? "s" : ""} expiring within 48 hours
                </span>
              </div>
              {showExpiring
                ? <ChevronUp size={14} className="text-red-400" />
                : <ChevronDown size={14} className="text-red-400" />
              }
            </button>
            {showExpiring && (
              <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {expiringDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} compact />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Top 10 Steals */}
        <TopSteals deals={top10} />

        {/* Deals Feed */}
        <section>
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <h2 className="text-[#1C1C1E] font-semibold text-lg flex items-center gap-2">
              <Package size={17} className="text-[#AEAEB2]" />
              Deals Feed
              <span className="text-[#AEAEB2] text-sm font-normal">
                {filteredDeals.length} result{filteredDeals.length !== 1 ? "s" : ""}
              </span>
            </h2>

            <div className="flex items-center gap-2">
              <label className="text-xs text-[#6C6C70] font-medium">Min discount:</label>
              <select
                value={minDiscount}
                onChange={(e) => setMinDiscount(Number(e.target.value))}
                className="bg-white border border-black/[0.08] rounded-xl text-sm text-[#1C1C1E] px-3 py-1.5 focus:outline-none focus:border-amber-400/50 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
              >
                <option value={0}>Any</option>
                <option value={10}>10%+</option>
                <option value={20}>20%+</option>
                <option value={30}>30%+</option>
                <option value={50}>50%+</option>
              </select>
            </div>
          </div>

          <div className="mb-5">
            <CategoryTabs active={activeCategory} onChange={setActiveCategory} counts={categoryCounts} />
          </div>

          {filteredDeals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-[#AEAEB2]">
              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                <Package size={28} className="text-[#C7C7CC]" />
              </div>
              <p className="font-medium text-[#6C6C70]">No deals match your filters</p>
              <p className="text-sm mt-1">Try a different category or search term</p>
            </div>
          )}
        </section>

        {/* Always Available Shelf */}
        {evergreen.length > 0 && (
          <section>
            <div className="border-t border-black/[0.07] pt-6">
              <button
                onClick={() => setShowEvergreen(!showEvergreen)}
                className="flex items-center gap-2.5 mb-4 group"
              >
                <h3 className="text-[#6C6C70] font-medium text-sm group-hover:text-[#1C1C1E] transition-colors">
                  Always Available Shelf
                </h3>
                <span className="text-xs text-[#AEAEB2] bg-white rounded-full px-2.5 py-0.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                  {evergreen.length} evergreen
                </span>
                {showEvergreen
                  ? <ChevronUp size={13} className="text-[#AEAEB2]" />
                  : <ChevronDown size={13} className="text-[#AEAEB2]" />
                }
              </button>
              {showEvergreen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {evergreen.map((deal) => (
                    <DealCard key={deal.id} deal={deal} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer
        className="mt-12 py-5 px-4 bg-white"
        style={{ borderTop: "1px solid rgba(60,60,67,0.1)" }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-[#AEAEB2] flex-wrap gap-2">
          <span>DealDetective — Read-only. No emails modified. No codes auto-applied.</span>
          {realDeals.length > 0 ? (
            <span className="text-emerald-500 font-medium">
              {realDeals.length} deals from Gmail
            </span>
          ) : (
            <span className="text-amber-500 font-medium">Connect Gmail to load deals</span>
          )}
        </div>
      </footer>
    </div>
  );
}
