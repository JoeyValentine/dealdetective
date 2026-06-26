import { Subscription } from "@/types/subscription";

// ponytail: outer Map keyed by userId — scoped so users never see each other's subscriptions
const g = globalThis as typeof globalThis & { __subscriptionStore?: Map<string, Map<string, Subscription>> };
if (!g.__subscriptionStore) g.__subscriptionStore = new Map();
const root = g.__subscriptionStore;

function userStore(userId: string): Map<string, Subscription> {
  if (!root.has(userId)) root.set(userId, new Map());
  return root.get(userId)!;
}

export function addSubscriptions(userId: string, subs: Subscription[]): void {
  const store = userStore(userId);
  for (const sub of subs) {
    const key = sub.serviceNormalized;
    const existing = store.get(key);
    const subDate = sub.lastBilledDate ?? sub.sourceEmail.receivedAt;
    const existDate = existing ? (existing.lastBilledDate ?? existing.sourceEmail.receivedAt) : "";
    if (!existing || subDate > existDate) {
      store.set(key, sub);
    }
  }
}

export function getSubscriptions(userId: string): Subscription[] {
  return Array.from(userStore(userId).values());
}

export function getSubscriptionCount(userId: string): number {
  return userStore(userId).size;
}

export function clearSubscriptionStore(userId: string): void {
  root.delete(userId);
}
