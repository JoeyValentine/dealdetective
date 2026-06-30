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
  await db.from("deals").upsert(rows, { onConflict: "user_id,dedup_key" });
}

export async function getRealDeals(userId: string): Promise<Deal[]> {
  const { data } = await db.from("deals").select("data").eq("user_id", userId);
  return (data ?? []).map((row: { data: Deal }) => row.data);
}

export async function getStoreCount(userId: string): Promise<number> {
  const { count } = await db.from("deals").select("*", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}

export async function clearStore(userId: string): Promise<void> {
  await db.from("deals").delete().eq("user_id", userId);
}
