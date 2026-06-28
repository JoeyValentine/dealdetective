"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
import { Bell, Radar, ChevronDown, ChevronUp, Package, Sparkles, CreditCard, AlertTriangle } from "lucide-react";

type MobileTab = "deals" | "bills";
type ScanState = "idle" | "scanning" | "done" | "error";

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
  const [showBellDropdown, setShowBellDropdown] = useState(false);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanResult, setScanResult] = useState<{ deals: number; subs: number; emails: number } | null>(null);
  const [foundCount, setFoundCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const handleScan = useCallback(async () => {
    setScanState("scanning");
    setFoundCount(0);
    setErrorMsg("");
    startTimer();

    try {
      const dealFetchPromise = fetch("/api/gmail/sync", { method: "POST" });
      const subSyncPromise = fetch("/api/gmail/subscriptions", { method: "POST" })
        .then((r) => r.json())
        .catch(() => null);

      const dealRes = await dealFetchPromise;
      if (!dealRes.ok) {
        const err = await dealRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Sync failed: ${dealRes.status}`);
      }

      const accumulated: Deal[] = [];
      let scannedCount = 0;

      if (dealRes.body) {
        const reader = dealRes.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line) as { type: string; deals?: Deal[]; scanned?: number };
              if (chunk.type === "deals" && Array.isArray(chunk.deals)) {
                accumulated.push(...chunk.deals);
                setFoundCount(accumulated.length);
                setRealDeals([...accumulated]);
              } else if (chunk.type === "done") {
                scannedCount = chunk.scanned ?? 0;
              }
            } catch { /* skip malformed line */ }
          }
        }
      }

      await subSyncPromise;
      const subsRes = await fetch("/api/gmail/subscriptions").then((r) => r.json()).catch(() => ({ subscriptions: [] }));
      const subs: Subscription[] = subsRes.subscriptions ?? [];

      stopTimer();
      setScanState("done");
      setScanResult({ deals: accumulated.length, subs: subs.length, emails: scannedCount });
      setRealDeals([...accumulated]);
      setSubscriptions(subs);

      const monthlyTotal = subs
        .filter((s) => s.status !== "cancelled")
        .reduce((sum, s) => {
          const mo = s.frequency === "annual" ? s.amount / 12
            : s.frequency === "weekly" ? s.amount * (52 / 12)
            : s.amount;
          return sum + mo;
        }, 0);
      const msgs: string[] = [];
      if (accumulated.length > 0) msgs.push(`${accumulated.length} deals found — you're saving smart! 🎟️`);
      if (subs.length > 0) msgs.push(`Found ${subs.length} subscriptions — $${monthlyTotal.toFixed(2)}/month in recurring charges 💰`);
      if (msgs.length > 0) setConfettiMsgs(msgs);
    } catch (err) {
      stopTimer();
      setErrorMsg(err instanceof Error ? err.message : "Scan failed");
      setScanState("error");
    }
  }, [startTimer, stopTimer]);

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

  const top10 = useMemo(() => {
    const counts = new Map<string, number>();
    return allActive
      .filter((d) => d.urgency !== "evergreen" && d.expirationStatus !== "expired")
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .filter((d) => {
        const c = counts.get(d.retailerNormalized) ?? 0;
        if (c >= 2) return false;
        counts.set(d.retailerNormalized, c + 1);
        return true;
      })
      .slice(0, 10);
  }, [allActive]);

  const evergreen = useMemo(() => allActive.filter((d) => d.urgency === "evergreen"), [allActive]);
  const expiringDeals = useMemo(() => allActive.filter((d) => d.urgency === "urgent"), [allActive]);

  const billingAlerts = useMemo(() => {
    const ALERT_KEYWORDS = ['failed payment', 'payment failed', 'payment declined', 'update required', 'past due', 'overdue', 'expires soon', 'card expired'];
    return subscriptions.filter((s) => {
      const text = (s.notes + ' ' + s.sourceEmail.subject).toLowerCase();
      return ALERT_KEYWORDS.some((k) => text.includes(k));
    });
  }, [subscriptions]);

  const bellCount = expiringDeals.length + billingAlerts.length;

  const bellItems = useMemo(() => {
    type BellItem = { label: string; sub: string; type: 'deal' | 'alert'; sectionId: string; gmailUrl?: string };
    const gmailLink = (msgId?: string) => msgId ? `https://mail.google.com/mail/u/0/#inbox/${msgId}` : undefined;
    const items: BellItem[] = [];
    for (const d of expiringDeals.slice(0, 3)) {
      items.push({
        label: d.retailer,
        sub: `${d.discountValue}${d.discountUnit === 'percent' ? '%' : '$'} off — expiring soon`,
        type: 'deal',
        sectionId: 'expiring-soon',
        gmailUrl: gmailLink(d.sourceEmail.messageId),
      });
    }
    for (const s of billingAlerts.slice(0, 2)) {
      items.push({
        label: s.serviceName,
        sub: s.notes || 'Billing alert',
        type: 'alert',
        sectionId: 'bills',
        gmailUrl: gmailLink(s.sourceEmail.messageId),
      });
    }
    return items.slice(0, 5);
  }, [expiringDeals, billingAlerts]);

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
    const ranked = rankDeals(deals);
    const counts = new Map<string, number>();
    return ranked.filter((d) => {
      const c = counts.get(d.retailerNormalized) ?? 0;
      if (c >= 3) return false;
      counts.set(d.retailerNormalized, c + 1);
      return true;
    });
  }, [allActive, activeCategory, searchQuery, minDiscount]);

  // ── Shared render pieces ──────────────────────────────────────────────────

  const HeroEmpty = (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 py-16">
      <div
        className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-[28px] flex items-center justify-center mx-auto mb-6"
        style={{ boxShadow: "0 8px 32px rgba(245,158,11,0.15)" }}
      >
        <Radar size={44} className="text-amber-500" />
      </div>
      <h2 className="text-3xl font-bold text-[var(--text-1)] mb-3">Connect Gmail to unlock your deals</h2>
      <p className="text-[var(--text-2)] max-w-sm mx-auto leading-relaxed mb-8">
        DealDetective scans your Promotions inbox and surfaces every discount, promo code, and flash sale — ranked by urgency and value.
      </p>
      <GmailConnect large scanState={scanState} onScan={handleScan} foundCount={foundCount} elapsed={elapsed} scanResult={scanResult} errorMsg={errorMsg} />
      <div className="mt-10 flex items-center gap-6 text-xs text-[var(--text-3)]">
        <span>✓ Read-only access</span>
        <span>✓ No emails modified</span>
        <span>✓ No codes auto-applied</span>
      </div>
    </div>
  );

  const DealsContent = (
    <div className="space-y-7">
      <StatsBar stats={stats} />

      {expiringDeals.length > 0 && (
        <div
          id="expiring-soon"
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
          <div className="relative">
            <button
              onClick={() => setShowBellDropdown((v) => !v)}
              className="relative p-2 bg-[var(--surface)] rounded-xl hover:opacity-80 transition-opacity"
            >
              <Bell size={15} className="text-[var(--text-2)]" />
              {bellCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                  {bellCount}
                </span>
              )}
            </button>
            {showBellDropdown && (
              <>
                <div className="fixed inset-0 z-[41]" onClick={() => setShowBellDropdown(false)} />
                <div className="absolute right-0 top-full mt-2 w-72 bg-[var(--card)] rounded-2xl shadow-xl border border-[var(--border)] z-[42] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)]">
                    <p className="text-sm font-semibold text-[var(--text-1)]">Notifications</p>
                  </div>
                  {bellItems.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-[var(--text-3)]">No urgent items</div>
                  ) : (
                    <div className="py-1">
                      {bellItems.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setShowBellDropdown(false);
                            if (item.gmailUrl) {
                              window.open(item.gmailUrl, '_blank', 'noopener,noreferrer');
                            } else if (item.type === 'alert' && window.innerWidth < 1024) {
                              setMobileTab('bills');
                              setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                            } else if (item.type === 'deal' && window.innerWidth < 1024) {
                              setMobileTab('deals');
                              setTimeout(() => document.getElementById('expiring-soon')?.scrollIntoView({ behavior: 'smooth' }), 50);
                            } else {
                              document.getElementById(item.sectionId)?.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-[var(--surface)] transition-colors flex items-start gap-3"
                        >
                          <span className={`mt-0.5 shrink-0 ${item.type === 'alert' ? 'text-red-500' : 'text-amber-500'}`}>
                            {item.type === 'alert' ? <AlertTriangle size={14} /> : <Bell size={14} />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--text-1)] truncate">{item.label}</p>
                            <p className="text-xs text-[var(--text-3)] truncate mt-0.5">{item.sub}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <GmailConnect
            scanState={scanState}
            onScan={handleScan}
            foundCount={foundCount}
            elapsed={elapsed}
            scanResult={scanResult}
            errorMsg={errorMsg}
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
          id="bills"
          className="w-[300px] xl:w-[320px] shrink-0 border-r border-[var(--border)] sticky top-[57px] overflow-y-auto scrollbar-hide"
          style={{ height: "calc(100vh - 57px)" }}
        >
          <SubscriptionSidebar subscriptions={subscriptions} />
        </aside>

        {/* Right main content */}
        <main className="flex-1 min-w-0 px-6 py-6">
          {realDeals.length === 0 ? HeroEmpty : DealsContent}
        </main>
      </div>

      {/* ── Mobile: tab-based layout ── */}
      <div className="lg:hidden pb-20">
        {mobileTab === "deals" && (
          <div className="px-4 py-5">{realDeals.length === 0 ? HeroEmpty : DealsContent}</div>
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
