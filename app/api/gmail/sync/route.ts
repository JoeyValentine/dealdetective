import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchPromoEmails } from "@/lib/gmailFetcher";
import { parseEmailWithClaude } from "@/lib/parser";
import { addDeals, getStoreCount, clearStore } from "@/lib/dealStore";
import { clearSubscriptionStore } from "@/lib/subscriptionStore";

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST() {
  const session = await auth();
  const userId = session?.user?.email;

  if (!session?.accessToken || !userId) {
    return NextResponse.json({ error: "Not authenticated with Gmail" }, { status: 401 });
  }

  try {
    const emails = await fetchPromoEmails(session.accessToken);

    let newDeals = 0;
    const BATCH = 5;
    for (let i = 0; i < emails.length; i += BATCH) {
      const results = await Promise.allSettled(
        emails.slice(i, i + BATCH).map((email) => parseEmailWithClaude(email))
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.length > 0) {
          addDeals(userId, r.value);
          newDeals += r.value.length;
        }
      }
    }

    const totalStored = getStoreCount(userId);
    console.log(`[/api/gmail/sync] user=${userId} scanned=${emails.length} newDeals=${newDeals} storeSize=${totalStored}`);
    return NextResponse.json({ scanned: emails.length, newDeals, totalStored });
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
