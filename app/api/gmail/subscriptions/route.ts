import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchBillingEmails } from "@/lib/gmailFetcher";
import { parseSubscriptionWithClaude } from "@/lib/subscriptionParser";
import { addSubscriptions, getSubscriptions, getSubscriptionCount } from "@/lib/subscriptionStore";
import type { Subscription } from "@/types/subscription";

export const runtime = 'nodejs';
export const maxDuration = 300;

const SUB_SIGNAL_KEYWORDS = ['your subscription', 'next billing', 'renews', 'autopay', 'monthly plan', 'billing cycle', 'auto-renew', 'recurring', 'subscription fee'];

export async function POST() {
  const session = await auth();
  const userId = session?.user?.email;
  if (!session?.accessToken || !userId) {
    return NextResponse.json({ error: "Not authenticated with Gmail" }, { status: 401 });
  }

  try {
    const emails = await fetchBillingEmails(session.accessToken);

    // Count how many billing emails arrive from each sender domain
    const domainFreq = new Map<string, number>();
    for (const e of emails) {
      const d = (e.senderDomain || '').toLowerCase();
      if (d) domainFreq.set(d, (domainFreq.get(d) ?? 0) + 1);
    }

    // Parse all emails, collect candidates
    const candidates: Subscription[] = [];
    const BATCH = 5;
    for (let i = 0; i < emails.length; i += BATCH) {
      const results = await Promise.allSettled(
        emails.slice(i, i + BATCH).map((email) => parseSubscriptionWithClaude(email))
      );
      for (const r of results) {
        if (r.status === "fulfilled") candidates.push(...r.value);
      }
    }

    // Post-filter: a candidate is verified if any of these are true:
    //   1. Amount < $50 — small recurring charges are almost always real
    //   2. Claude identified an explicit billing frequency (not "unknown")
    //   3. The sender domain appears 2+ times in billing emails
    //   4. Subject or notes contain known subscription signal keywords
    const verified = candidates.filter((sub) => {
      if (sub.amount < 50) return true;
      if (sub.frequency !== 'unknown') return true;
      const domain = (sub.sourceEmail.senderDomain || '').toLowerCase();
      if ((domainFreq.get(domain) ?? 0) >= 2) return true;
      const text = (sub.sourceEmail.subject + ' ' + sub.notes).toLowerCase();
      return SUB_SIGNAL_KEYWORDS.some((k) => text.includes(k));
    });

    const filtered = candidates.length - verified.length;
    console.log(`[subscriptions] user=${userId} scanned=${emails.length} candidates=${candidates.length} kept=${verified.length} dropped=${filtered}`);

    if (verified.length > 0) {
      addSubscriptions(userId, verified);
    }

    const totalStored = getSubscriptionCount(userId);
    return NextResponse.json({ scanned: emails.length, newSubs: verified.length, totalStored });
  } catch (err) {
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
