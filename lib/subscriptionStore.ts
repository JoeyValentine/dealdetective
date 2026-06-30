import { Subscription } from "@/types/subscription";
import { db } from "@/lib/db";

// In-memory fallback when Supabase is not configured
const g = globalThis as typeof globalThis & { __subMem?: Map<string, Subscription> };
function mem(): Map<string, Subscription> {
  if (!g.__subMem) g.__subMem = new Map();
  return g.__subMem;
}

export async function addSubscriptions(userId: string, subs: Subscription[]): Promise<void> {
  if (subs.length === 0) return;
  if (db) {
    const rows = subs.map((s) => ({
      user_id: userId,
      service_normalized: s.serviceNormalized,
      data: s,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from("subscriptions").upsert(rows, { onConflict: "user_id,service_normalized" });
    if (error) throw new Error(`addSubscriptions failed: ${error.message}`);
    return;
  }
  const store = mem();
  for (const s of subs) store.set(`${userId}:${s.serviceNormalized}`, s);
}

export async function getSubscriptions(userId: string): Promise<Subscription[]> {
  if (db) {
    const { data, error } = await db.from("subscriptions").select("data").eq("user_id", userId);
    if (error) throw new Error(`getSubscriptions failed: ${error.message}`);
    return (data ?? []).map((row: { data: Subscription }) => row.data);
  }
  return Array.from(mem().entries())
    .filter(([k]) => k.startsWith(`${userId}:`))
    .map(([, v]) => v);
}

export async function getSubscriptionCount(userId: string): Promise<number> {
  if (db) {
    const { count, error } = await db.from("subscriptions").select("*", { count: "exact", head: true }).eq("user_id", userId);
    if (error) throw new Error(`getSubscriptionCount failed: ${error.message}`);
    return count ?? 0;
  }
  return Array.from(mem().keys()).filter((k) => k.startsWith(`${userId}:`)).length;
}

export async function clearSubscriptionStore(userId: string): Promise<void> {
  if (db) {
    const { error } = await db.from("subscriptions").delete().eq("user_id", userId);
    if (error) throw new Error(`clearSubscriptionStore failed: ${error.message}`);
    return;
  }
  for (const k of Array.from(mem().keys())) {
    if (k.startsWith(`${userId}:`)) mem().delete(k);
  }
}
