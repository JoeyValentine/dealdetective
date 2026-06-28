"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { Deal } from "@/types/deal";
import { Subscription } from "@/types/subscription";
import { Mail, LogOut, RefreshCw, AlertCircle, Loader } from "lucide-react";

interface Props {
  onSyncComplete: (deals: Deal[]) => void;
  onSubscriptionSyncComplete?: (subs: Subscription[]) => void;
  large?: boolean;
}

type ScanState = "idle" | "scanning" | "done" | "error";

export default function GmailConnect({ onSyncComplete, onSubscriptionSyncComplete, large }: Props) {
  const { data: session, status } = useSession();
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanResult, setScanResult] = useState<{ deals: number; subs: number; emails: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTimer() {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }
  useEffect(() => () => stopTimer(), []);

  function formatElapsed(s: number): string {
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  const handleScan = async () => {
    setScanState("scanning");
    setErrorMsg("");
    startTimer();

    try {
      // Run both scans in parallel
      const [dealSync, subSync] = await Promise.allSettled([
        fetch("/api/gmail/sync", { method: "POST" }).then((r) => r.json()),
        fetch("/api/gmail/subscriptions", { method: "POST" }).then((r) => r.json()),
      ]);

      const dealData = dealSync.status === "fulfilled" ? dealSync.value : { scanned: 0, newDeals: 0 };
      const subData  = subSync.status  === "fulfilled" ? subSync.value  : { scanned: 0, newSubs: 0 };

      // Fetch stored results for both
      const [dealsRes, subsRes] = await Promise.allSettled([
        fetch("/api/gmail/deals").then((r) => r.json()),
        fetch("/api/gmail/subscriptions").then((r) => r.json()),
      ]);

      stopTimer();
      setScanState("done");

      const deals = dealsRes.status === "fulfilled" ? (dealsRes.value.deals ?? []) : [];
      const subs  = subsRes.status  === "fulfilled" ? (subsRes.value.subscriptions ?? []) : [];

      setScanResult({
        deals: deals.length,
        subs: subs.length,
        emails: (dealData.scanned ?? 0) + (subData.scanned ?? 0),
      });

      onSyncComplete(deals);
      onSubscriptionSyncComplete?.(subs);
    } catch (err) {
      stopTimer();
      setErrorMsg(err instanceof Error ? err.message : "Scan failed");
      setScanState("error");
    }
  };

  if (status === "loading") return null;

  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        className={large
          ? "flex items-center gap-3 bg-amber-500 hover:bg-amber-600 text-white text-base font-semibold px-8 py-4 rounded-2xl transition-colors shadow-lg shadow-amber-200/60 dark:shadow-amber-900/40"
          : "flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] text-[var(--text-1)] text-sm font-medium px-3.5 py-2 rounded-xl hover:bg-[var(--surface)] transition-colors shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
        }
      >
        <Mail size={large ? 20 : 14} className={large ? "text-white" : "text-amber-500"} />
        Connect Gmail
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {scanState === "scanning" && (
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 text-sm text-[var(--text-2)]">
            <Loader size={13} className="animate-spin text-amber-500 shrink-0" />
            <span className="hidden sm:inline">Scanning… {formatElapsed(elapsed)}</span>
          </div>
          <span className="text-xs text-[var(--text-3)] hidden sm:inline">Deals + Bills · Est. 3–5 min</span>
          <div className="relative w-32 h-1 bg-[var(--surface)] rounded-full overflow-hidden hidden sm:block">
            <div className="scanning-bar rounded-full" />
          </div>
        </div>
      )}

      {scanState === "done" && scanResult && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hidden sm:inline">
          {scanResult.deals} deals · {scanResult.subs} subs
        </span>
      )}

      {scanState === "error" && (
        <div className="flex items-center gap-1.5 text-xs text-red-500" title={errorMsg}>
          <AlertCircle size={13} />
          <span className="hidden sm:inline">Scan failed</span>
        </div>
      )}

      {scanState !== "scanning" && (
        <button
          onClick={handleScan}
          className={large
            ? "flex items-center gap-3 bg-amber-500 hover:bg-amber-600 text-white text-base font-semibold px-8 py-4 rounded-2xl transition-colors shadow-lg shadow-amber-200/60 dark:shadow-amber-900/40"
            : "flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 text-xs font-medium px-3 py-1.5 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          }
          title={`Signed in as ${session.user?.email}`}
        >
          {scanState === "done"
            ? <><RefreshCw size={large ? 18 : 12} /> Rescan</>
            : <><Mail size={large ? 20 : 12} /> Scan Gmail</>
          }
        </button>
      )}

      <button
        onClick={async () => {
          await fetch("/api/gmail/sync", { method: "DELETE" });
          signOut();
        }}
        className="p-1.5 text-[var(--text-3)] hover:text-[var(--text-2)] rounded-lg hover:bg-[var(--surface)] transition-colors"
        title="Disconnect Gmail"
      >
        <LogOut size={13} />
      </button>
    </div>
  );
}
