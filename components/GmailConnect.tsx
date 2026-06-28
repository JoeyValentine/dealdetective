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
  const [foundCount, setFoundCount] = useState(0);
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
    setFoundCount(0);
    setErrorMsg("");
    startTimer();

    try {
      // Start both in parallel — deal scan streams, sub scan is regular JSON
      const dealFetchPromise = fetch("/api/gmail/sync", { method: "POST" });
      const subSyncPromise = fetch("/api/gmail/subscriptions", { method: "POST" })
        .then((r) => r.json())
        .catch(() => null);

      const dealRes = await dealFetchPromise;
      if (!dealRes.ok) {
        const err = await dealRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Sync failed: ${dealRes.status}`);
      }

      // Read streaming NDJSON response
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
                onSyncComplete([...accumulated]);
              } else if (chunk.type === "done") {
                scannedCount = chunk.scanned ?? 0;
              }
            } catch { /* skip malformed line */ }
          }
        }
      }

      // Wait for subscription scan (already running in parallel)
      await subSyncPromise;

      const subsRes = await fetch("/api/gmail/subscriptions")
        .then((r) => r.json())
        .catch(() => ({ subscriptions: [] }));
      const subs: Subscription[] = subsRes.subscriptions ?? [];

      stopTimer();
      setScanState("done");
      setScanResult({ deals: accumulated.length, subs: subs.length, emails: scannedCount });

      onSyncComplete([...accumulated]);
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
            <span className="hidden sm:inline">
              {foundCount > 0 ? `Found ${foundCount} deals · ` : "Scanning… "}{formatElapsed(elapsed)}
            </span>
          </div>
          <span className="text-xs text-[var(--text-3)] hidden sm:inline">
            {foundCount > 0 ? "Adding to your feed…" : "Deals + Bills · Est. 60–90s"}
          </span>
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
