import { Subscription } from "@/types/subscription";

// ponytail: globalThis singleton — survives Turbopack module reloads, resets on process restart
const g = globalThis as typeof globalThis & { __subscriptionStore?: Map<string, Subscription> };
if (!g.__subscriptionStore) g.__subscriptionStore = new Map<string, Subscription>();
const store = g.__subscriptionStore;

export function addSubscriptions(subs: Subscription[]): void {
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

export function getSubscriptions(): Subscription[] {
  return Array.from(store.values());
}

export function getSubscriptionCount(): number {
  return store.size;
}

export function clearSubscriptionStore(): void {
  store.clear();
}
