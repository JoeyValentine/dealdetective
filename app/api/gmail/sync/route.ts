import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchPromoEmails } from "@/lib/gmailFetcher";
import { parseEmailsBatchWithClaude } from "@/lib/parser";
import type { Deal } from "@/types/deal";
import { addDeals, getStoreCount, clearStore } from "@/lib/dealStore";
import { clearSubscriptionStore } from "@/lib/subscriptionStore";

export const runtime = 'nodejs';
export const maxDuration = 300;

const PROMO_KEYWORDS = ['%', 'off', 'deal', 'sale', 'promo', 'code', 'coupon', 'discount', 'free', 'bogo', 'save', 'offer', 'expires', 'limited'];

export async function POST() {
  const session = await auth();
  const userId = session?.user?.email;

  if (!session?.accessToken || !userId) {
    return NextResponse.json({ error: "Not authenticated with Gmail" }, { status: 401 });
  }

  try {
    const emails = await fetchPromoEmails(session.accessToken, 100);

    // Pre-filter: skip emails with no deal-related keywords in subject or snippet
    const filtered = emails.filter((e) => {
      const text = (e.subject + " " + e.body.slice(0, 500)).toLowerCase();
      return PROMO_KEYWORDS.some((k) => text.includes(k));
    });

    let newDeals = 0;
    const BATCH = 5;     // emails per Claude call
    const PARALLEL = 4;  // concurrent Claude calls per group

    for (let i = 0; i < filtered.length; i += BATCH * PARALLEL) {
      const group: Promise<Deal[]>[] = [];
      for (let j = 0; j < PARALLEL; j++) {
        const slice = filtered.slice(i + j * BATCH, i + (j + 1) * BATCH);
        if (slice.length > 0) group.push(parseEmailsBatchWithClaude(slice));
      }
      const results = await Promise.allSettled(group);
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.length > 0) {
          addDeals(userId, r.value);
          newDeals += r.value.length;
        }
      }
    }

    const totalStored = getStoreCount(userId);
    console.log(`[/api/gmail/sync] user=${userId} scanned=${emails.length} filtered=${filtered.length} newDeals=${newDeals} storeSize=${totalStored}`);
    return NextResponse.json({ scanned: emails.length, filtered: filtered.length, newDeals, totalStored });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.email;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  clearStore(userId);
  clearSubscriptionStore(userId);
  return NextResponse.json({ ok: true });
}
