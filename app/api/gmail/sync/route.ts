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
const MAX_EMAILS = 1000;
const MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const PAGE_SIZE = 100;
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
      let fastBatchDone = false;
      const startTime = Date.now();

      try {
        while (totalScanned < MAX_EMAILS && Date.now() - startTime < MAX_DURATION_MS) {
          const { emails, nextPageToken, count } = await fetchPromoEmailsPage(accessToken, pageToken, PAGE_SIZE);
          totalScanned += count;

          if (count > 0) {
            const filtered = emails.filter((e) => {
              const text = (e.subject + " " + e.body.slice(0, 500)).toLowerCase();
              return PROMO_KEYWORDS.some((k) => text.includes(k));
            });

            if (filtered.length > 0) {
              // Fast first batch: pull the first 10 emails (2 parallel Claude calls of 5)
              // and stream them immediately so deals appear on screen within ~15s.
              if (!fastBatchDone) {
                fastBatchDone = true;
                const fast = filtered.splice(0, BATCH * 2);
                const fastDeals = (
                  await Promise.allSettled(
                    [fast.slice(0, BATCH), fast.slice(BATCH)]
                      .filter((s) => s.length > 0)
                      .map(parseEmailsBatchWithClaude)
                  )
                ).flatMap((r) => (r.status === "fulfilled" ? r.value : []))
                  .filter((d) => d.expirationStatus !== "expired");
                if (fastDeals.length > 0) {
                  addDeals(userId, fastDeals);
                  totalDeals += fastDeals.length;
                  write({ type: "deals", deals: fastDeals, totalFound: totalDeals, scanned: totalScanned });
                }
              }

              // Remaining emails: normal groups of PARALLEL batches
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
              const activeBatch = batchDeals.filter((d) => d.expirationStatus !== "expired");
              if (activeBatch.length > 0) {
                addDeals(userId, activeBatch);
                totalDeals += activeBatch.length;
                write({ type: "deals", deals: activeBatch, totalFound: totalDeals, scanned: totalScanned });
              }
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
