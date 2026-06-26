"use client";

import { useState, useMemo, useCallback } from "react";
import { rankDeals, searchDeals } from "@/lib/ranker";
import { Category, Deal } from "@/types/deal";
import { Subscription } from "@/types/subscription";
import DealCard from "@/components/DealCard";
import TopSteals from "@/components/TopSteals";
import CategoryTabs from "@/components/CategoryTabs";
import SearchBar from "@/components/SearchBar";
import StatsBar from "@/components/StatsBar";
import GmailConnect from "@/components/GmailConnect";
import ThemeToggle from "@/components/ThemeToggle";
import Confetti from "@/components/Confetti";
import SubscriptionSidebar from "@/components/SubscriptionSidebar";
import { Bell, Radar, ChevronDown, ChevronUp, Package, Sparkles, CreditCard } from "lucide-react";

type MobileTab = "deals" | "bills";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExpiring, setShowExpiring] = useState(true);
  const [showEvergreen, setShowEvergreen] = useState(false);
  const [minDiscount, setMinDiscount] = useState(0);
  const [realDeals, setRealDeals] = useState<Deal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [confettiMsgs, setConfettiMsgs] = useState<string[] | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("deals");

  const handleSyncComplete = useCallback((deals: Deal[]) => {
    setRealDeals(deals);
  }, []);

  const handleSubscriptionSyncComplete = useCallback((subs: Subscription[]) => {
    setSubscriptions(subs);
    // Fire confetti once we have both results (deals already set via handleSyncComplete)
    setRealDeals((prev) => {
      const monthlyTotal = subs
        .filter((s) => s.status !== "cancelled")
        .reduce((sum, s) => {
          const mo = s.frequency === "annual" ? s.amount / 12
            : s.frequency === "weekly" ? s.amount * (52 / 12)
            : s.amount;
          return sum + mo;
        }, 0);

      const msgs: string[] = [];
      if (prev.length > 0) msgs.push(`${prev.length} deals found — you're saving smart! 🎟️`);
      if (subs.length > 0) msgs.push(`Found ${subs.length} subscriptions — $${monthlyTotal.toFixed(2)}/month in recurring charges 💰`);
      if (msgs.length > 0) setConfettiMsgs(msgs);

      return prev;
    });
  }, []);

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

  const evergreen = useMemo(() => allActive.filter((d) => d.urgency === "evergreen"), [allActive]);
  const expiringDeals = useMemo(() => allActive.filter((d) => d.urgency === "urgent"), [allActive]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<Category | "All", number>> = {};
    const feed = allActive.filter((d) => d.urgency !== "evergreen");
    counts["All"] = feed.length;
    feed.forEach((d) => { counts[d.category] = (counts[d.category] || 0) + 1; });
    return counts;
  }, [allActive]);

  const filteredDeals = useMemo(() => {
    let deals = allActive.filter((d) => d.urgency !== "evergreen");
    if (activeCategory !== "All") deals = deals.filter((d) => d.category === activeCategory);
    if (searchQuery) deals = searchDeals(deals, searchQuery);
    if (minDiscount > 0) deals = deals.filter((d) => d.effectiveDiscountPercent >= minDiscount);
    return rankDeals(deals);
  }, [allActive, activeCategory, searchQuery, minDiscount]);

  // ── Shared render pieces ──────────────────────────────────────────────────

  const DealsContent = (
    <div className="space-y-7">
      <StatsBar stats={stats} />

      {expiringDeals.length > 0 && (
        <div
          className="bg-[var(--card)] rounded-[20px] overflow-hidden"
          style={{ boxShadow: "0 2px 12px rgba(239,68,68,0.08)" }}
        >
          <button
            onClick={() => setShowExpiring(!showExpiring)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-red-50/40 dark:hover:bg-red-900/10 transition-colors"
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
            {showExpiring ? <ChevronUp size={14} className="text-red-400" /> : <ChevronDown size={14} className="text-red-400" />}
          </button>
          {showExpiring && (
            <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {expiringDeals.map((deal) => <DealCard key={deal.id} deal={deal} compact />)}
            </div>
          )}
        </div>
      )}

      <TopSteals deals={top10} />

      <section>
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h2 className="text-[var(--text-1)] font-semibold text-lg flex items-center gap-2">
            <Package size={17} className="text-[var(--text-3)]" />
            Deals Feed
            <span className="text-[var(--text-3)] text-sm font-normal">{filteredDeals.length} result{filteredDeals.length !== 1 ? "s" : ""}</span>
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-2)] font-medium">Min discount:</label>
            <select
              value={minDiscount}
              onChange={(e) => setMinDiscount(Number(e.target.value))}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-1)] px-3 py-1.5 focus:outline-none focus:border-amber-400/50 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredDeals.map((deal) => <DealCard key={deal.id} deal={deal} />)}
          </div>
        ) : (
          <div className="text-center py-20 text-[var(--text-3)]">
            <div className="w-20 h-20 bg-[var(--card)] rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ boxShadow: "var(--shadow-stats)" }}>
              {realDeals.length === 0 ? <Sparkles size={32} className="text-amber-400" /> : <Package size={32} className="text-[var(--text-3)]" />}
            </div>
            {realDeals.length === 0 ? (
              <>
                <p className="font-semibold text-[var(--text-1)] text-lg mb-2">Connect Gmail to unlock your deals</p>
                <p className="text-sm text-[var(--text-3)] max-w-xs mx-auto">DealDetective scans your Promotions tab and surfaces every discount, promo code, and flash sale — ranked by urgency.</p>
              </>
            ) : (
              <>
                <p className="font-medium text-[var(--text-2)]">No deals match your filters</p>
                <p className="text-sm mt-1">Try a different category or search term</p>
              </>
            )}
          </div>
        )}
      </section>

      {evergreen.length > 0 && (
        <section>
          <div className="border-t border-[var(--border)] pt-6">
            <button onClick={() => setShowEvergreen(!showEvergreen)} className="flex items-center gap-2.5 mb-4 group">
              <h3 className="text-[var(--text-2)] font-medium text-sm group-hover:text-[var(--text-1)] transition-colors">Always Available Shelf</h3>
              <span className="text-xs text-[var(--text-3)] bg-[var(--card)] rounded-full px-2.5 py-0.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">{evergreen.length} evergreen</span>
              {showEvergreen ? <ChevronUp size={13} className="text-[var(--text-3)]" /> : <ChevronDown size={13} className="text-[var(--text-3)]" />}
            </button>
            {showEvergreen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {evergreen.map((deal) => <DealCard key={deal.id} deal={deal} />)}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );

  // ── Header ────────────────────────────────────────────────────────────────

  const Header = (
    <header
      className="bg-[var(--card)]/90 backdrop-blur-md sticky top-0 z-40"
      style={{ borderBottom: "1px solid var(--border)", boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
    >
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-2xl p-2">
            <Radar size={17} className="text-amber-500" />
          </div>
          <div>
            <h1 className="font-semibold text-[var(--text-1)] text-sm leading-none">DealDetective</h1>
            <p className="text-[var(--text-3)] text-[11px] leading-none mt-0.5 font-medium">Promo Intel</p>
          </div>
        </div>

        <div className="flex-1 max-w-lg">
          <SearchBar onSearch={setSearchQuery} placeholder="Search brands, categories, codes…" />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <button className="relative p-2 bg-[var(--surface)] rounded-xl hover:opacity-80 transition-opacity">
            <Bell size={15} className="text-[var(--text-2)]" />
            {expiringDeals.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                {expiringDeals.length}
              </span>
            )}
          </button>
          <GmailConnect
            onSyncComplete={handleSyncComplete}
            onSubscriptionSyncComplete={handleSubscriptionSyncComplete}
          />
        </div>
      </div>
    </header>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {confettiMsgs && (
        <Confetti messages={confettiMsgs} onDone={() => setConfettiMsgs(null)} />
      )}

      {Header}

      {/* ── Desktop: two-column layout ── */}
      <div className="hidden lg:flex max-w-[1600px] mx-auto">
        {/* Left sidebar */}
        <aside
          className="w-[300px] xl:w-[320px] shrink-0 border-r border-[var(--border)] sticky top-[57px] overflow-y-auto scrollbar-hide"
          style={{ height: "calc(100vh - 57px)" }}
        >
          <SubscriptionSidebar subscriptions={subscriptions} />
        </aside>

        {/* Right main content */}
        <main className="flex-1 min-w-0 px-6 py-6">
          {DealsContent}
        </main>
      </div>

      {/* ── Mobile: tab-based layout ── */}
      <div className="lg:hidden pb-20">
        {mobileTab === "deals" && (
          <div className="px-4 py-5">{DealsContent}</div>
        )}
        {mobileTab === "bills" && (
          <div className="h-[calc(100vh-57px-64px)] overflow-y-auto">
            <SubscriptionSidebar subscriptions={subscriptions} />
          </div>
        )}
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-[var(--card)]/95 backdrop-blur-md"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="flex">
          <button
            onClick={() => setMobileTab("deals")}
            className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${
              mobileTab === "deals" ? "text-amber-500" : "text-[var(--text-3)]"
            }`}
          >
            <Package size={20} />
            Deals
            {realDeals.length > 0 && (
              <span className={`text-[10px] leading-none ${mobileTab === "deals" ? "text-amber-500" : "text-[var(--text-3)]"}`}>
                {realDeals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobileTab("bills")}
            className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${
              mobileTab === "bills" ? "text-amber-500" : "text-[var(--text-3)]"
            }`}
          >
            <CreditCard size={20} />
            Bills
            {subscriptions.length > 0 && (
              <span className={`text-[10px] leading-none ${mobileTab === "bills" ? "text-amber-500" : "text-[var(--text-3)]"}`}>
                {subscriptions.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Desktop footer */}
      <footer
        className="hidden lg:block mt-12 py-5 px-4 bg-[var(--card)]"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="max-w-[1600px] mx-auto flex items-center justify-between text-xs text-[var(--text-3)] flex-wrap gap-2">
          <span>DealDetective — Read-only. No emails modified. No codes auto-applied.</span>
          <div className="flex items-center gap-4">
            {subscriptions.length > 0 && (
              <span className="text-blue-500 font-medium">{subscriptions.length} subscriptions tracked</span>
            )}
            {realDeals.length > 0 ? (
              <span className="text-emerald-500 font-medium">{realDeals.length} deals from Gmail</span>
            ) : (
              <span className="text-amber-500 font-medium">Connect Gmail to load deals</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
