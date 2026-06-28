"use client";

import { useMemo } from "react";
import { Subscription, SubscriptionCategory, SubscriptionFrequency } from "@/types/subscription";
import { ExternalLink, ShieldCheck, ShieldAlert, ShieldOff, CreditCard, TrendingUp, Lock, AlertTriangle } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toMonthly(amount: number, frequency: SubscriptionFrequency): number {
  switch (frequency) {
    case "monthly": return amount;
    case "annual":  return amount / 12;
    case "weekly":  return amount * (52 / 12);
    default:        return amount;
  }
}

function formatAmount(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function freqLabel(f: SubscriptionFrequency): string {
  return { monthly: "/mo", annual: "/yr", weekly: "/wk", unknown: "" }[f];
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Category config ───────────────────────────────────────────────────────────

const CAT: Record<SubscriptionCategory, { dot: string; bg: string; text: string }> = {
  Entertainment: { dot: "bg-purple-500",  bg: "bg-purple-50 dark:bg-purple-900/20",  text: "text-purple-600 dark:text-purple-400" },
  Health:        { dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400" },
  SaaS:          { dot: "bg-blue-500",    bg: "bg-blue-50 dark:bg-blue-900/20",    text: "text-blue-600 dark:text-blue-400" },
  Utilities:     { dot: "bg-orange-500",  bg: "bg-orange-50 dark:bg-orange-900/20",  text: "text-orange-600 dark:text-orange-400" },
  Food:          { dot: "bg-teal-500",    bg: "bg-teal-50 dark:bg-teal-900/20",    text: "text-teal-600 dark:text-teal-400" },
  Other:         { dot: "bg-[var(--text-3)]", bg: "bg-[var(--surface)]",          text: "text-[var(--text-3)]" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfidenceDot({ score }: { score: Subscription["confidenceScore"] }) {
  const map = {
    high:   { icon: ShieldCheck, cls: "text-emerald-500" },
    medium: { icon: ShieldAlert,  cls: "text-amber-500" },
    low:    { icon: ShieldOff,    cls: "text-red-400" },
  };
  const { icon: Icon, cls } = map[score];
  return <span title={`${score} confidence`}><Icon size={11} className={cls} /></span>;
}

function SubscriptionItem({ sub, highlight }: { sub: Subscription; highlight?: boolean }) {
  const days = daysUntil(sub.nextBillingDate);
  const cat = CAT[sub.category];
  const isCancelled = sub.status === "cancelled";

  return (
    <div
      className={`rounded-2xl px-3.5 py-3 transition-all ${
        highlight
          ? "bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-700/30"
          : "bg-[var(--surface)] hover:bg-[var(--border)]"
      } ${isCancelled ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${cat.dot}`} />
          <div className="min-w-0">
            <p className={`text-sm font-semibold leading-tight truncate ${isCancelled ? "line-through" : "text-[var(--text-1)]"}`}>
              {sub.serviceName}
            </p>
            {sub.notes && (
              <p className="text-xs text-[var(--text-3)] leading-tight truncate mt-0.5">{sub.notes}</p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold tabular-nums ${highlight ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-1)]"}`}>
            {formatAmount(sub.amount)}<span className="text-xs font-normal text-[var(--text-3)]">{freqLabel(sub.frequency)}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {sub.nextBillingDate && !isCancelled && (
            <span className={`text-xs ${days !== null && days <= 7 ? "text-amber-500 font-medium" : "text-[var(--text-3)]"}`}>
              {days === null ? "" : days <= 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days}d`}
              {days !== null && days > 1 && <span className="text-[var(--text-3)] font-normal"> · {formatDate(sub.nextBillingDate)}</span>}
            </span>
          )}
          {isCancelled && <span className="text-xs text-[var(--text-3)]">Cancelled</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <ConfidenceDot score={sub.confidenceScore} />
          {sub.sourceEmail.messageId && (
            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${sub.sourceEmail.messageId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-3)] hover:text-amber-500 transition-colors"
            >
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main sidebar component ────────────────────────────────────────────────────

interface Props {
  subscriptions: Subscription[];
}

export default function SubscriptionSidebar({ subscriptions }: Props) {
  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const active = useMemo(
    () => subscriptions
      .filter((s) => s.status !== "cancelled")
      .sort((a, b) => {
        if (!a.nextBillingDate) return 1;
        if (!b.nextBillingDate) return -1;
        return a.nextBillingDate.localeCompare(b.nextBillingDate);
      }),
    [subscriptions]
  );

  const cancelled = useMemo(
    () => subscriptions.filter((s) => s.status === "cancelled"),
    [subscriptions]
  );

  const upcomingThisWeek = useMemo(
    () => active.filter((s) => {
      if (!s.nextBillingDate) return false;
      const d = new Date(s.nextBillingDate);
      return d >= now && d <= weekOut;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active]
  );

  const monthlyTotal = useMemo(
    () => active.reduce((sum, s) => sum + toMonthly(s.amount, s.frequency), 0),
    [active]
  );

  const byCategory = useMemo(() => {
    const map: Partial<Record<SubscriptionCategory, number>> = {};
    for (const s of active) {
      map[s.category] = (map[s.category] ?? 0) + toMonthly(s.amount, s.frequency);
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a) as [SubscriptionCategory, number][];
  }, [active]);

  const biggest = useMemo(
    () => active.reduce<Subscription | null>(
      (max, s) => !max || toMonthly(s.amount, s.frequency) > toMonthly(max.amount, max.frequency) ? s : max,
      null
    ),
    [active]
  );

  const BILLING_ALERT_KEYWORDS = ['failed payment', 'payment failed', 'payment declined', 'update required', 'past due', 'overdue', 'expires soon', 'card expired'];

  const alerts = useMemo(
    () => subscriptions.flatMap((s) => {
      const text = (s.notes + ' ' + s.sourceEmail.subject).toLowerCase();
      const matched = BILLING_ALERT_KEYWORDS.find((k) => text.includes(k));
      return matched ? [{ sub: s, message: matched }] : [];
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscriptions]
  );

  const isEmpty = subscriptions.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard size={15} className="text-amber-500" />
          <h2 className="font-semibold text-[var(--text-1)] text-sm">Subscriptions & Bills</h2>
        </div>
        <p className="text-xs text-[var(--text-3)]">Auto-detected from your inbox</p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-5">
        {isEmpty ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 bg-[var(--surface)] rounded-3xl flex items-center justify-center mx-auto mb-3">
              <CreditCard size={24} className="text-[var(--text-3)]" />
            </div>
            <p className="font-medium text-[var(--text-2)] text-sm">No subscriptions found</p>
            <p className="text-xs text-[var(--text-3)] mt-1 max-w-[200px] mx-auto">
              Scan Gmail to detect your recurring charges
            </p>
          </div>
        ) : (
          <>
            {/* ── Important Alerts ── */}
            {alerts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-red-500" />
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Important Alerts</p>
                  <span className="ml-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">{alerts.length}</span>
                </div>
                {alerts.map(({ sub, message }) => (
                  <div key={sub.id} className="rounded-2xl px-3.5 py-3 bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-700/30 flex items-start gap-2.5">
                    <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-1)] truncate">{sub.serviceName}</p>
                      <p className="text-xs text-red-500 capitalize mt-0.5">{message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Hero stat ── */}
            <div
              className="rounded-[20px] p-4"
              style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, var(--card) 60%)", boxShadow: "var(--shadow-stats)" }}
            >
              <p className="text-xs text-[var(--text-3)] font-medium mb-1">Monthly Recurring</p>
              <p className="text-3xl font-bold text-amber-500 tabular-nums">{formatAmount(monthlyTotal)}<span className="text-base font-normal text-[var(--text-3)]">/mo</span></p>
              <p className="text-xs text-[var(--text-3)] mt-1">
                ≈ {formatAmount(monthlyTotal * 12)}/year · {active.length} active
              </p>
            </div>

            {/* ── Analytics ── */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={12} className="text-[var(--text-3)]" />
                <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">Breakdown</p>
              </div>

              {byCategory.map(([cat, mo]) => (
                <div key={cat} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${CAT[cat].dot}`} />
                    <span className="text-xs text-[var(--text-2)]">{cat}</span>
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-1)] tabular-nums">
                    {formatAmount(mo)}<span className="font-normal text-[var(--text-3)]">/mo</span>
                  </span>
                </div>
              ))}

              {biggest && (
                <div className="mt-2 pt-2.5 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--text-3)]">
                    Biggest: <span className="text-[var(--text-1)] font-medium">{biggest.serviceName}</span> at <span className="font-semibold">{formatAmount(biggest.amount)}{freqLabel(biggest.frequency)}</span>
                  </p>
                </div>
              )}
            </div>

            {/* ── Upcoming This Week ── */}
            {upcomingThisWeek.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">Upcoming This Week</p>
                {upcomingThisWeek.map((s) => (
                  <SubscriptionItem key={s.id} sub={s} highlight />
                ))}
              </div>
            )}

            {/* ── Active Subscriptions ── */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                Active Subscriptions <span className="normal-case font-normal text-[var(--text-3)]">({active.length})</span>
              </p>
              {active.map((s) => (
                <SubscriptionItem key={s.id} sub={s} />
              ))}
            </div>

            {/* ── Recently Cancelled ── */}
            {cancelled.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">Recently Cancelled</p>
                {cancelled.map((s) => (
                  <SubscriptionItem key={s.id} sub={s} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Privacy footer */}
      <div className="px-4 py-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-3)]">
          <Lock size={11} />
          Data stays on your device
        </div>
      </div>
    </div>
  );
}
