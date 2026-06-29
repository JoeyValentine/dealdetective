"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Mail, LogOut, RefreshCw, AlertCircle, Loader } from "lucide-react";

type ScanState = "idle" | "scanning" | "done" | "error";

interface Props {
  large?: boolean;
  scanState: ScanState;
  onScan: () => void;
  foundCount: number;
  scannedEmails?: number;
  elapsed: number;
  scanResult: { deals: number; subs: number; emails: number } | null;
  errorMsg: string;
}

function formatElapsed(s: number): string {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function GmailConnect({ large, scanState, onScan, foundCount, scannedEmails, elapsed, scanResult, errorMsg }: Props) {
  const { data: session, status } = useSession();

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

  const scanLabel = foundCount > 0
    ? `${foundCount} deals found${scannedEmails ? ` across ${scannedEmails} emails` : ""} · ${formatElapsed(elapsed)}`
    : `Scanning… ${formatElapsed(elapsed)}`;

  const scanningUI = large ? (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3 text-[var(--text-1)]">
        <Loader size={22} className="animate-spin text-amber-500" />
        <span className="text-base font-medium">{scanLabel}</span>
      </div>
      <p className="text-sm text-[var(--text-3)]">
        {foundCount > 0 ? "Adding to your feed…" : "Deals + Bills · scanning all pages"}
      </p>
      <div className="relative w-48 h-1.5 bg-[var(--surface)] rounded-full overflow-hidden mt-1">
        <div className="scanning-bar rounded-full" />
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 text-sm text-[var(--text-2)]">
        <Loader size={13} className="animate-spin text-amber-500 shrink-0" />
        <span className="hidden sm:inline">{scanLabel}</span>
      </div>
      <span className="text-xs text-[var(--text-3)] hidden sm:inline">
        {foundCount > 0 ? "Adding to your feed…" : "Deals + Bills · scanning all pages"}
      </span>
      <div className="relative w-32 h-1 bg-[var(--surface)] rounded-full overflow-hidden hidden sm:block">
        <div className="scanning-bar rounded-full" />
      </div>
    </div>
  );

  return (
    <div className={`flex items-center gap-2 ${large ? "flex-col" : ""}`}>
      {scanState === "scanning" && scanningUI}

      {scanState === "done" && scanResult && !large && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hidden sm:inline">
          {scanResult.deals} deals · {scanResult.subs} subs
        </span>
      )}

      {scanState === "error" && (
        <div className="flex items-center gap-1.5 text-xs text-red-500" title={errorMsg}>
          <AlertCircle size={13} />
          <span className={large ? "" : "hidden sm:inline"}>Scan failed</span>
        </div>
      )}

      {scanState !== "scanning" && (
        <button
          onClick={onScan}
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

      {!large && (
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
      )}
    </div>
  );
}
