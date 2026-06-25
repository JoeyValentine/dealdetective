import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchPromoEmails } from "@/lib/gmailFetcher";
import { parseEmailWithClaude } from "@/lib/parser";
import { addDeals, getStoreCount } from "@/lib/dealStore";

export async function POST() {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated with Gmail" }, { status: 401 });
  }

  try {
    const emails = await fetchPromoEmails(session.accessToken);

    let newDeals = 0;
    // Parse in batches of 5 concurrent Claude calls
    const BATCH = 5;
    for (let i = 0; i < emails.length; i += BATCH) {
      const results = await Promise.allSettled(
        emails.slice(i, i + BATCH).map((email) => parseEmailWithClaude(email))
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.length > 0) {
          addDeals(r.value);
          newDeals += r.value.length;
        }
      }
    }

    return NextResponse.json({
      scanned: emails.length,
      newDeals,
      totalStored: getStoreCount(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
