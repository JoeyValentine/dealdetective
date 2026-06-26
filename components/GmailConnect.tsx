"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { Deal } from "@/types/deal";
import { Mail, LogOut, RefreshCw, CheckCircle, AlertCircle, Loader } from "lucide-react";

interface Props {
  onSyncComplete: (deals: Deal[]) => void;
}

type ScanState = "idle" | "scanning" | "done" | "error";

export default function GmailConnect({ onSyncComplete }: Props) {
  const { data: session, status } = useSession();
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanResult, setScanResult] = useState<{ scanned: number; newDeals: number } | null>(null);
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
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  const handleScan = async () => {
    setScanState("scanning");
    setErrorMsg("");
    startTimer();
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      setScanResult({ scanned: data.scanned, newDeals: data.newDeals });

      const dealsRes = await fetch("/api/gmail/deals");
      const dealsData = await dealsRes.json();

      stopTimer();
      setScanState("done");
      onSyncComplete(dealsData.deals ?? []);
    } catch (err) {
      stopTimer();
      setErrorMsg(err instanceof Error ? err.message : "Sync failed");
      setScanState("error");
    }
  };

  if (status === "loading") return null;

  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] text-[var(--text-1)] text-sm font-medium px-3.5 py-2 rounded-xl hover:bg-[var(--surface)] transition-colors shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
      >
        <Mail size={14} className="text-amber-500" />
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
          <span className="text-xs text-[var(--text-3)] hidden sm:inline">Est. ~2–3 min</span>
          <div className="relative w-32 h-1 bg-[var(--surface)] rounded-full overflow-hidden hidden sm:block">
            <div className="scanning-bar rounded-full" />
          </div>
        </div>
      )}

      {scanState === "done" && scanResult && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hidden sm:inline">
          {scanResult.newDeals} deal{scanResult.newDeals !== 1 ? "s" : ""} from {scanResult.scanned} emails
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
          className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 text-xs font-medium px-3 py-1.5 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          title={`Signed in as ${session.user?.email}`}
        >
          {scanState === "done"
            ? <><RefreshCw size={12} /> Rescan</>
            : <><Mail size={12} /> Scan Gmail</>
          }
        </button>
      )}

      <button
        onClick={() => signOut()}
        className="p-1.5 text-[var(--text-3)] hover:text-[var(--text-2)] rounded-lg hover:bg-[var(--surface)] transition-colors"
        title="Disconnect Gmail"
      >
        <LogOut size={13} />
      </button>
    </div>
  );
}
