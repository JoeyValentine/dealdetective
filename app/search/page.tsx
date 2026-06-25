"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getActiveDeals } from "@/lib/mockData";
import { searchDeals, rankDeals } from "@/lib/ranker";
import DealCard from "@/components/DealCard";
import SearchBar from "@/components/SearchBar";
import { Radar, ArrowLeft, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Category } from "@/types/deal";

function SearchResults() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [minDiscount, setMinDiscount] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<Category | "All">("All");

  const allDeals = getActiveDeals();

  const results = useMemo(() => {
    let deals = includeExpired
      ? [...allDeals]
      : allDeals.filter((d) => d.expirationStatus !== "expired");

    if (categoryFilter !== "All") deals = deals.filter((d) => d.category === categoryFilter);
    if (minDiscount > 0) deals = deals.filter((d) => d.effectiveDiscountPercent >= minDiscount);
    if (query) deals = searchDeals(deals, query);

    return rankDeals(deals).sort((a, b) => b.effectiveDiscountPercent - a.effectiveDiscountPercent);
  }, [query, includeExpired, minDiscount, categoryFilter, allDeals]);

  const categories = useMemo(() => {
    const cats = new Set(allDeals.map((d) => d.category));
    return Array.from(cats) as Category[];
  }, [allDeals]);

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Header */}
      <header
        className="bg-white/90 backdrop-blur-md sticky top-0 z-40"
        style={{ borderBottom: "1px solid rgba(60,60,67,0.1)", boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#6C6C70] hover:text-[#1C1C1E] transition-colors shrink-0"
          >
            <div className="bg-amber-50 rounded-2xl p-2">
              <Radar size={15} className="text-amber-500" />
            </div>
            <ArrowLeft size={14} />
          </Link>
          <div className="flex-1">
            <SearchBar
              defaultValue={query}
              onSearch={setQuery}
              placeholder="Search brands, categories, promo codes…"
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex items-center gap-2.5 mb-6 flex-wrap">
          <div className="flex items-center gap-1.5 text-[#AEAEB2]">
            <SlidersHorizontal size={13} />
            <span className="text-xs font-medium">Filters</span>
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as Category | "All")}
            className="bg-white border border-black/[0.08] rounded-xl text-sm text-[#1C1C1E] px-3 py-1.5 focus:outline-none focus:border-amber-400/50 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
          >
            <option value="All">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={minDiscount}
            onChange={(e) => setMinDiscount(Number(e.target.value))}
            className="bg-white border border-black/[0.08] rounded-xl text-sm text-[#1C1C1E] px-3 py-1.5 focus:outline-none focus:border-amber-400/50 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
          >
            <option value={0}>Any discount</option>
            <option value={10}>10%+ off</option>
            <option value={20}>20%+ off</option>
            <option value={30}>30%+ off</option>
            <option value={50}>50%+ off</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-[#6C6C70] cursor-pointer bg-white rounded-xl px-3 py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-black/[0.07]">
            <input
              type="checkbox"
              checked={includeExpired}
              onChange={(e) => setIncludeExpired(e.target.checked)}
              className="rounded border-[#C7C7CC] text-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            Include expired
          </label>
        </div>

        {/* Results header */}
        <div className="mb-5">
          {query ? (
            <p className="text-[#6C6C70] text-sm">
              <span className="text-[#1C1C1E] font-semibold">{results.length}</span>{" "}
              result{results.length !== 1 ? "s" : ""} for{" "}
              <span className="text-amber-500 font-mono">&ldquo;{query}&rdquo;</span>
              {results.length > 0 && (
                <span className="text-[#AEAEB2]"> — highest discount first</span>
              )}
            </p>
          ) : (
            <p className="text-[#AEAEB2] text-sm">Type a brand, category, or promo code above</p>
          )}
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        ) : query ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <span className="text-4xl">🔍</span>
            </div>
            <p className="font-semibold text-[#1C1C1E] mb-1">No deals found for &ldquo;{query}&rdquo;</p>
            <p className="text-sm text-[#AEAEB2]">Try a different brand name, category, or promo code</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
