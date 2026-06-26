"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";
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

  const handleScan = async () => {
    setScanState("scanning");
    setErrorMsg("");
    try {
      // Step 1: run the scan
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      console.log("[GmailConnect] sync response:", data);
      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      setScanResult({ scanned: data.scanned, newDeals: data.newDeals });

      // Step 2: fetch the actual deals from the store (separate endpoint avoids huge inline payload)
      const dealsRes = await fetch("/api/gmail/deals");
      const dealsData = await dealsRes.json();
      console.log("[GmailConnect] fetched", dealsData.count, "real deals from store");
      console.log("[GmailConnect] first 5 deals:", dealsData.deals?.slice(0, 5));

      setScanState("done");
      onSyncComplete(dealsData.deals ?? []);
      console.log("[GmailConnect] called onSyncComplete with", (dealsData.deals ?? []).length, "deals");
    } catch (err) {
      console.error("[GmailConnect] scan error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Sync failed");
      setScanState("error");
    }
  };

  if (status === "loading") return null;

  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        className="flex items-center gap-2 bg-white border border-black/[0.1] text-[#1C1C1E] text-sm font-medium px-3.5 py-2 rounded-xl hover:bg-[#F2F2F7] transition-colors shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
      >
        <Mail size={14} className="text-amber-500" />
        Connect Gmail
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {scanState === "scanning" && (
        <div className="flex items-center gap-2 text-sm text-[#6C6C70]">
          <Loader size={13} className="animate-spin text-amber-500" />
          <span className="hidden sm:inline">Scanning Gmail…</span>
        </div>
      )}

      {scanState === "done" && scanResult && (
        <span className="text-xs text-emerald-600 font-medium hidden sm:inline">
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
          className="flex items-center gap-1.5 bg-amber-50 border border-amber-200/60 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-xl hover:bg-amber-100 transition-colors"
          title={`Signed in as ${session.user?.email}`}
        >
          {scanState === "done" ? (
            <><RefreshCw size={12} /> Rescan</>
          ) : (
            <><Mail size={12} /> Scan Gmail</>
          )}
        </button>
      )}

      <button
        onClick={() => signOut()}
        className="p-1.5 text-[#AEAEB2] hover:text-[#6C6C70] rounded-lg hover:bg-[#F2F2F7] transition-colors"
        title="Disconnect Gmail"
      >
        <LogOut size={13} />
      </button>
    </div>
  );
}
