import { Deal } from "@/types/deal";

// ponytail: outer Map keyed by userId — scoped so users never see each other's deals
// resets on process restart — add DB when persistence matters
const g = globalThis as typeof globalThis & { __dealStore?: Map<string, Map<string, Deal>> };
if (!g.__dealStore) g.__dealStore = new Map();
const root = g.__dealStore;

function userStore(userId: string): Map<string, Deal> {
  if (!root.has(userId)) root.set(userId, new Map());
  return root.get(userId)!;
}

function dedupKey(d: Deal): string {
  return `${d.retailerNormalized}:${d.promoCode ?? ""}:${d.discountValue}:${d.offerType}`;
}

export function addDeals(userId: string, deals: Deal[]): void {
  const store = userStore(userId);
  for (const deal of deals) {
    const key = dedupKey(deal);
    const existing = store.get(key);
    if (!existing || deal.sourceEmail.receivedAt > existing.sourceEmail.receivedAt) {
      store.set(key, deal);
    }
  }
}

export function getRealDeals(userId: string): Deal[] {
  return Array.from(userStore(userId).values());
}

export function getStoreCount(userId: string): number {
  return userStore(userId).size;
}

export function clearStore(userId: string): void {
  root.delete(userId);
}
