import { Subscription } from "@/types/subscription";
import { db } from "@/lib/db";

export async function addSubscriptions(userId: string, subs: Subscription[]): Promise<void> {
  if (subs.length === 0) return;
  const rows = subs.map((s) => ({
    user_id: userId,
    service_normalized: s.serviceNormalized,
    data: s,
    updated_at: new Date().toISOString(),
  }));
  await db.from("subscriptions").upsert(rows, { onConflict: "user_id,service_normalized" });
}

export async function getSubscriptions(userId: string): Promise<Subscription[]> {
  const { data } = await db.from("subscriptions").select("data").eq("user_id", userId);
  return (data ?? []).map((row: { data: Subscription }) => row.data);
}

export async function getSubscriptionCount(userId: string): Promise<number> {
  const { count } = await db.from("subscriptions").select("*", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}

export async function clearSubscriptionStore(userId: string): Promise<void> {
  await db.from("subscriptions").delete().eq("user_id", userId);
}
