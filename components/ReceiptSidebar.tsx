"use client";

import { useMemo, useState } from "react";
import { Receipt } from "@/types/receipt";
import { ExternalLink, ChevronDown, ChevronRight, Lock, ShoppingBag } from "lucide-react";

function formatAmount(n: number): string {
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthGroup { key: string; label: string; total: number; receipts: Receipt[] }
interface QuarterGroup { key: string; label: string; total: number; months: MonthGroup[] }
interface YearGroup { key: string; label: string; total: number; quarters: QuarterGroup[] }

interface Props {
  receipts: Receipt[];
}

export default function ReceiptSidebar({ receipts }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const tree = useMemo<YearGroup[]>(() => {
    const sorted = [...receipts].sort((a, b) => {
      const da = a.orderDate ?? a.sourceEmail.receivedAt;
      const db = b.orderDate ?? b.sourceEmail.receivedAt;
      return db.localeCompare(da);
    });

    const yearMap = new Map<string, Map<string, Map<string, Receipt[]>>>();
    for (const r of sorted) {
      const d = new Date(r.orderDate ?? r.sourceEmail.receivedAt);
      const year = String(d.getFullYear());
      const qKey = `${year}-Q${Math.floor(d.getMonth() / 3) + 1}`;
      const mKey = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      if (!yearMap.has(year)) yearMap.set(year, new Map());
      const qMap = yearMap.get(year)!;
      if (!qMap.has(qKey)) qMap.set(qKey, new Map());
      const mMap = qMap.get(qKey)!;
      if (!mMap.has(mKey)) mMap.set(mKey, []);
      mMap.get(mKey)!.push(r);
    }

    return Array.from(yearMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, qMap]) => {
        const quarters = Array.from(qMap.entries())
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([qKey, mMap]) => {
            const months = Array.from(mMap.entries())
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([mKey, rcpts]) => ({
                key: mKey,
                label: MONTHS[parseInt(mKey.split("-")[1]) - 1],
                total: rcpts.reduce((s, r) => s + r.amount, 0),
                receipts: rcpts,
              }));
            return {
              key: qKey,
              label: qKey.split("-")[1],
              total: months.reduce((s, m) => s + m.total, 0),
              months,
            };
          });
        return {
          key: year,
          label: year,
          total: quarters.reduce((s, q) => s + q.total, 0),
          quarters,
        };
      });
  }, [receipts]);

  const grandTotal = useMemo(() => receipts.reduce((s, r) => s + r.amount, 0), [receipts]);
  const isEmpty = receipts.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 mb-1">
          <ShoppingBag size={15} className="text-emerald-500" />
          <h2 className="font-semibold text-[var(--text-1)] text-sm">Receipts</h2>
        </div>
        <p className="text-xs text-[var(--text-3)]">Purchase history from your inbox</p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-4">
        {isEmpty ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 bg-[var(--surface)] rounded-3xl flex items-center justify-center mx-auto mb-3">
              <ShoppingBag size={24} className="text-[var(--text-3)]" />
            </div>
            <p className="font-medium text-[var(--text-2)] text-sm">No receipts found</p>
            <p className="text-xs text-[var(--text-3)] mt-1 max-w-[200px] mx-auto">
              Scan Gmail to detect your purchase history
            </p>
          </div>
        ) : (
          <>
            {/* Grand total hero */}
            <div
              className="rounded-[20px] p-4"
              style={{
                background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, var(--card) 60%)",
                boxShadow: "var(--shadow-stats)",
              }}
            >
              <p className="text-xs text-[var(--text-3)] font-medium mb-1">Total Spent (12 mo)</p>
              <p className="text-3xl font-bold text-emerald-500 tabular-nums">{formatAmount(grandTotal)}</p>
              <p className="text-xs text-[var(--text-3)] mt-1">{receipts.length} receipts</p>
            </div>

            {/* Year → Quarter → Month → receipts */}
            {tree.map((yg) => (
              <div key={yg.key} className="space-y-0.5">
                {/* Year header — always visible */}
                <div className="flex items-center justify-between px-1 py-1.5">
                  <span className="text-xs font-bold text-[var(--text-1)] uppercase tracking-wide">{yg.label}</span>
                  <span className="text-xs font-semibold text-[var(--text-2)] tabular-nums">{formatAmount(yg.total)}</span>
                </div>

                {yg.quarters.map((qg) => {
                  const qOpen = !collapsed.has(qg.key);
                  return (
                    <div key={qg.key} className="ml-2">
                      {/* Quarter row */}
                      <button
                        onClick={() => toggle(qg.key)}
                        className="w-full flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-[var(--surface)] transition-colors text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          {qOpen
                            ? <ChevronDown size={12} className="text-[var(--text-3)]" />
                            : <ChevronRight size={12} className="text-[var(--text-3)]" />}
                          <span className="text-xs font-semibold text-[var(--text-2)]">{qg.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-[var(--text-2)] tabular-nums">{formatAmount(qg.total)}</span>
                      </button>

                      {qOpen && qg.months.map((mg) => {
                        const mOpen = !collapsed.has(mg.key);
                        return (
                          <div key={mg.key} className="ml-3">
                            {/* Month row */}
                            <button
                              onClick={() => toggle(mg.key)}
                              className="w-full flex items-center justify-between py-1 px-2 rounded-xl hover:bg-[var(--surface)] transition-colors text-left"
                            >
                              <div className="flex items-center gap-1.5">
                                {mOpen
                                  ? <ChevronDown size={11} className="text-[var(--text-3)]" />
                                  : <ChevronRight size={11} className="text-[var(--text-3)]" />}
                                <span className="text-xs text-[var(--text-2)]">{mg.label}</span>
                              </div>
                              <span className="text-xs text-[var(--text-3)] tabular-nums">{formatAmount(mg.total)}</span>
                            </button>

                            {mOpen && (
                              <div className="ml-3 space-y-1 mt-1 mb-1">
                                {mg.receipts.map((r) => (
                                  <div
                                    key={r.id}
                                    className="rounded-xl px-3 py-2 bg-[var(--surface)] hover:bg-[var(--border)] transition-colors"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-[var(--text-1)] truncate">{r.merchant}</p>
                                        {r.itemsSummary && (
                                          <p className="text-[11px] text-[var(--text-3)] truncate mt-0.5">{r.itemsSummary}</p>
                                        )}
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <p className="text-xs font-bold text-[var(--text-1)] tabular-nums">{formatAmount(r.amount)}</p>
                                        {r.orderDate && (
                                          <p className="text-[11px] text-[var(--text-3)]">{formatDate(r.orderDate)}</p>
                                        )}
                                      </div>
                                    </div>
                                    {r.emailLink && (
                                      <div className="flex justify-end mt-1">
                                        <a
                                          href={r.emailLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[var(--text-3)] hover:text-emerald-500 transition-colors"
                                          title="Open email"
                                        >
                                          <ExternalLink size={10} />
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-3)]">
          <Lock size={11} />
          Read-only · No emails modified
        </div>
      </div>
    </div>
  );
}
