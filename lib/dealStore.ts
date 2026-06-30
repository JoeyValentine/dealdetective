import { Deal } from "@/types/deal";
import { db } from "@/lib/db";

// In-memory fallback when Supabase is not configured
const g = globalThis as typeof globalThis & { __dealMem?: Map<string, Deal> };
function mem(): Map<string, Deal> {
  if (!g.__dealMem) g.__dealMem = new Map();
  return g.__dealMem;
}

function dedupKey(d: Deal): string {
  return `${d.retailerNormalized}:${d.promoCode ?? ""}:${d.discountValue}:${d.offerType}`;
}

export async function addDeals(userId: string, deals: Deal[]): Promise<void> {
  if (deals.length === 0) return;
  if (db) {
    const rows = deals.map((d) => ({
      user_id: userId,
      dedup_key: dedupKey(d),
      data: d,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from("deals").upsert(rows, { onConflict: "user_id,dedup_key" });
    if (error) throw new Error(`addDeals failed: ${error.message}`);
    return;
  }
  const store = mem();
  for (const d of deals) store.set(`${userId}:${dedupKey(d)}`, d);
}

export async function getRealDeals(userId: string): Promise<Deal[]> {
  if (db) {
    const { data, error } = await db.from("deals").select("data").eq("user_id", userId);
    if (error) throw new Error(`getRealDeals failed: ${error.message}`);
    return (data ?? []).map((row: { data: Deal }) => row.data);
  }
  return Array.from(mem().entries())
    .filter(([k]) => k.startsWith(`${userId}:`))
    .map(([, v]) => v);
}

export async function getStoreCount(userId: string): Promise<number> {
  if (db) {
    const { count, error } = await db.from("deals").select("*", { count: "exact", head: true }).eq("user_id", userId);
    if (error) throw new Error(`getStoreCount failed: ${error.message}`);
    return count ?? 0;
  }
  return Array.from(mem().keys()).filter((k) => k.startsWith(`${userId}:`)).length;
}

export async function clearStore(userId: string): Promise<void> {
  if (db) {
    const { error } = await db.from("deals").delete().eq("user_id", userId);
    if (error) throw new Error(`clearStore failed: ${error.message}`);
    return;
  }
  for (const k of Array.from(mem().keys())) {
    if (k.startsWith(`${userId}:`)) mem().delete(k);
  }
}
