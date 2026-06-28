import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchPromoEmailsPage } from "@/lib/gmailFetcher";
import { parseEmailsBatchWithClaude } from "@/lib/parser";
import type { Deal } from "@/types/deal";
import { addDeals, getStoreCount, clearStore } from "@/lib/dealStore";
import { clearSubscriptionStore } from "@/lib/subscriptionStore";

export const runtime = 'nodejs';
export const maxDuration = 300;

const PROMO_KEYWORDS = ['%', 'off', 'deal', 'sale', 'promo', 'code', 'coupon', 'discount', 'free', 'bogo', 'save', 'offer', 'expires', 'limited'];
const MAX_EMAILS = 300;
const BATCH = 5;
const PARALLEL = 4;

export async function POST() {
  const session = await auth();
  const userId = session?.user?.email;

  if (!session?.accessToken || !userId) {
    return NextResponse.json({ error: "Not authenticated with Gmail" }, { status: 401 });
  }

  clearStore(userId);

  const encoder = new TextEncoder();
  const accessToken = session.accessToken;

  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      let totalScanned = 0;
      let totalDeals = 0;
      let pageToken: string | undefined;

      try {
        while (totalScanned < MAX_EMAILS) {
          const { emails, nextPageToken, count } = await fetchPromoEmailsPage(accessToken, pageToken);
          totalScanned += count;

          if (count > 0) {
            const filtered = emails.filter((e) => {
              const text = (e.subject + " " + e.body.slice(0, 500)).toLowerCase();
              return PROMO_KEYWORDS.some((k) => text.includes(k));
            });

            const batchDeals: Deal[] = [];
            for (let i = 0; i < filtered.length; i += BATCH * PARALLEL) {
              const group: Promise<Deal[]>[] = [];
              for (let j = 0; j < PARALLEL; j++) {
                const slice = filtered.slice(i + j * BATCH, i + (j + 1) * BATCH);
                if (slice.length > 0) group.push(parseEmailsBatchWithClaude(slice));
              }
              const results = await Promise.allSettled(group);
              for (const r of results) {
                if (r.status === "fulfilled") batchDeals.push(...r.value);
              }
            }

            if (batchDeals.length > 0) {
              addDeals(userId, batchDeals);
              totalDeals += batchDeals.length;
              write({ type: "deals", deals: batchDeals, totalFound: totalDeals, scanned: totalScanned });
            } else {
              write({ type: "progress", scanned: totalScanned, totalFound: totalDeals });
            }
          }

          pageToken = nextPageToken;
          if (!nextPageToken) break;
        }

        write({ type: "done", scanned: totalScanned, totalFound: totalDeals, totalStored: getStoreCount(userId) });
      } catch (err) {
        write({ type: "error", message: err instanceof Error ? err.message : "Scan failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.email;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  clearStore(userId);
  clearSubscriptionStore(userId);
  return NextResponse.json({ ok: true });
}
