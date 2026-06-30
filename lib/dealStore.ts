import { Deal } from "@/types/deal";
import { db } from "@/lib/db";

function dedupKey(d: Deal): string {
  return `${d.retailerNormalized}:${d.promoCode ?? ""}:${d.discountValue}:${d.offerType}`;
}

export async function addDeals(userId: string, deals: Deal[]): Promise<void> {
  if (deals.length === 0) return;
  const rows = deals.map((d) => ({
    user_id: userId,
    dedup_key: dedupKey(d),
    data: d,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await db.from("deals").upsert(rows, { onConflict: "user_id,dedup_key" });
  if (error) throw new Error(`addDeals failed: ${error.message}`);
}

export async function getRealDeals(userId: string): Promise<Deal[]> {
  const { data, error } = await db.from("deals").select("data").eq("user_id", userId);
  if (error) throw new Error(`getRealDeals failed: ${error.message}`);
  return (data ?? []).map((row: { data: Deal }) => row.data);
}

export async function getStoreCount(userId: string): Promise<number> {
  const { count, error } = await db.from("deals").select("*", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw new Error(`getStoreCount failed: ${error.message}`);
  return count ?? 0;
}

export async function clearStore(userId: string): Promise<void> {
  const { error } = await db.from("deals").delete().eq("user_id", userId);
  if (error) throw new Error(`clearStore failed: ${error.message}`);
}
