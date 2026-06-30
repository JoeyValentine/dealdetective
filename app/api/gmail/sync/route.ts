import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchPromoEmailsPage } from "@/lib/gmailFetcher";
import { fetchOutlookPromoPage } from "@/lib/outlookFetcher";
import { parseEmailsBatchWithClaude } from "@/lib/parser";
import type { Deal } from "@/types/deal";
import { addDeals, getStoreCount, clearStore } from "@/lib/dealStore";
import { clearSubscriptionStore } from "@/lib/subscriptionStore";

export const runtime = 'nodejs';
export const maxDuration = 300;

const PAGE_SIZE = 25;
const BATCH = 5;
const PARALLEL = 4;

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.email;

  if (!session?.accessToken || !userId) {
    return NextResponse.json({ error: "Not authenticated with Gmail" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { pageToken?: string };
  const incomingPageToken = body.pageToken || undefined;

  // Clear store only on the first chunk so subsequent chunks append
  if (!incomingPageToken) {
    clearStore(userId);
  }

  const isOutlook = session.provider === "microsoft-entra-id";
  const fetchPage = isOutlook ? fetchOutlookPromoPage : fetchPromoEmailsPage;

  const encoder = new TextEncoder();
  const accessToken = session.accessToken;

  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      let totalDeals = 0;

      try {
        const { emails, nextPageToken, count } = await fetchPage(accessToken, incomingPageToken, PAGE_SIZE);
        console.log(`[sync] listed=${count} bodies_fetched=${emails.length} pageToken=${!!incomingPageToken}`);

        if (count > 0) {
          // Fast first batch: first 10 emails as 2 parallel Claude calls so deals appear quickly
          const fast = emails.splice(0, BATCH * 2);
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
            write({ type: "deals", deals: fastDeals, totalFound: totalDeals, scanned: count });
          }

          // Remaining: parallel groups of 4 batches of 5
          const batchDeals: Deal[] = [];
          for (let i = 0; i < emails.length; i += BATCH * PARALLEL) {
            const group: Promise<Deal[]>[] = [];
            for (let j = 0; j < PARALLEL; j++) {
              const slice = emails.slice(i + j * BATCH, i + (j + 1) * BATCH);
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
            write({ type: "deals", deals: activeBatch, totalFound: totalDeals, scanned: count });
          }
        }

        write({
          type: "done",
          scanned: count,
          totalFound: totalDeals,
          totalStored: getStoreCount(userId),
          nextPageToken: nextPageToken ?? null,
        });
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
