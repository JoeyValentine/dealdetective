import { Receipt } from "@/types/receipt";
import { db } from "@/lib/db";

// In-memory fallback when Supabase is not configured
const g = globalThis as typeof globalThis & { __rcptMem?: Map<string, Receipt> };
function mem(): Map<string, Receipt> {
  if (!g.__rcptMem) g.__rcptMem = new Map();
  return g.__rcptMem;
}

function dedupKey(r: Receipt): string {
  return `${r.merchantNormalized}:${r.orderNumber ?? ""}:${r.orderDate?.slice(0, 10) ?? ""}`;
}

export async function addReceipts(userId: string, receipts: Receipt[]): Promise<void> {
  if (receipts.length === 0) return;
  if (db) {
    // Deduplicate within batch by conflict key — same pattern as addDeals to avoid
    // "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const seen = new Map<string, Receipt>();
    for (const r of receipts) seen.set(dedupKey(r), r);
    if (seen.size < receipts.length)
      console.log(`[addReceipts] dropped ${receipts.length - seen.size} in-batch duplicate key(s)`);
    const rows = Array.from(seen.values()).map((r) => ({
      user_id: userId,
      dedup_key: dedupKey(r),
      data: r,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from("receipts").upsert(rows, { onConflict: "user_id,dedup_key" });
    if (error) throw new Error(`addReceipts failed: ${error.message}`);
    return;
  }
  const store = mem();
  for (const r of receipts) store.set(`${userId}:${dedupKey(r)}`, r);
}

export async function getReceipts(userId: string): Promise<Receipt[]> {
  if (db) {
    const { data, error } = await db.from("receipts").select("data").eq("user_id", userId);
    if (error) throw new Error(`getReceipts failed: ${error.message}`);
    return (data ?? []).map((row: { data: Receipt }) => row.data);
  }
  return Array.from(mem().entries())
    .filter(([k]) => k.startsWith(`${userId}:`))
    .map(([, v]) => v);
}

export async function getReceiptCount(userId: string): Promise<number> {
  if (db) {
    const { count, error } = await db.from("receipts").select("*", { count: "exact", head: true }).eq("user_id", userId);
    if (error) throw new Error(`getReceiptCount failed: ${error.message}`);
    return count ?? 0;
  }
  return Array.from(mem().keys()).filter((k) => k.startsWith(`${userId}:`)).length;
}

export async function clearReceiptStore(userId: string): Promise<void> {
  if (db) {
    const { error } = await db.from("receipts").delete().eq("user_id", userId);
    if (error) throw new Error(`clearReceiptStore failed: ${error.message}`);
    return;
  }
  for (const k of Array.from(mem().keys())) {
    if (k.startsWith(`${userId}:`)) mem().delete(k);
  }
}
