import { Deal } from "@/types/deal";

// ponytail: global in-memory store, resets on server restart — add DB when persistence matters
const store = new Map<string, Deal>();

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
