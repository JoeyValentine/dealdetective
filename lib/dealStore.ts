import { Deal } from "@/types/deal";

// ponytail: anchored to globalThis so Turbopack module reloads don't reset it
// resets on server process restart — add DB when persistence matters
const g = globalThis as typeof globalThis & { __dealStore?: Map<string, Deal> };
if (!g.__dealStore) g.__dealStore = new Map<string, Deal>();
const store = g.__dealStore;

function dedupKey(d: Deal): string {
  return `${d.retailerNormalized}:${d.promoCode ?? ""}:${d.discountValue}:${d.offerType}`;
}

export function addDeals(deals: Deal[]): void {
  for (const deal of deals) {
    const key = dedupKey(deal);
    const existing = store.get(key);
    if (!existing || deal.sourceEmail.receivedAt > existing.sourceEmail.receivedAt) {
      store.set(key, deal);
    }
  }
}

export function getRealDeals(): Deal[] {
  return Array.from(store.values());
}

export function getStoreCount(): number {
  return store.size;
}

export function clearStore(): void {
  store.clear();
}
