import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchBillingEmails } from "@/lib/gmailFetcher";
import { parseSubscriptionWithClaude } from "@/lib/subscriptionParser";
import { addSubscriptions, getSubscriptions, getSubscriptionCount } from "@/lib/subscriptionStore";

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST() {
  const session = await auth();
  const userId = session?.user?.email;
  if (!session?.accessToken || !userId) {
    return NextResponse.json({ error: "Not authenticated with Gmail" }, { status: 401 });
  }

  try {
    const emails = await fetchBillingEmails(session.accessToken);
    console.log(`[subscriptions] Fetched ${emails.length} billing emails for ${userId}`);

    let newSubs = 0;
    const BATCH = 5;
    for (let i = 0; i < emails.length; i += BATCH) {
      const results = await Promise.allSettled(
        emails.slice(i, i + BATCH).map((email) => parseSubscriptionWithClaude(email))
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.length > 0) {
          addSubscriptions(userId, r.value);
          newSubs += r.value.length;
        }
      }
    }

    const totalStored = getSubscriptionCount(userId);
    console.log(`[/api/gmail/subscriptions] user=${userId} scanned=${emails.length} newSubs=${newSubs} storeSize=${totalStored}`);
    return NextResponse.json({ scanned: emails.length, newSubs, totalStored });
  } catch (err) {
    console.error(`[subscriptions] POST handler crashed for ${userId}:`, err);
    const message = err instanceof Error ? err.message : "Subscription scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.email;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const subs = getSubscriptions(userId);
  return NextResponse.json({ subscriptions: subs, count: subs.length });
}
