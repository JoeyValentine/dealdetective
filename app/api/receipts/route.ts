import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchReceiptEmails } from "@/lib/gmailFetcher";
import { fetchOutlookReceiptEmails } from "@/lib/outlookFetcher";
import { parseReceiptWithClaude } from "@/lib/receiptParser";
import { addReceipts, getReceipts, getReceiptCount, clearReceiptStore } from "@/lib/receiptStore";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const session = await auth();
  const userId = session?.user?.email;
  if (!session?.accessToken || !userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await clearReceiptStore(userId);

    const isOutlook = session.provider === "microsoft-entra-id";
    let emails: Awaited<ReturnType<typeof fetchReceiptEmails>>;

    if (isOutlook) {
      const { emails: outEmails, usedReceiptsFolder } = await fetchOutlookReceiptEmails(session.accessToken);
      emails = outEmails;
      console.log(`[receipts] Outlook: ${emails.length} emails from ${usedReceiptsFolder ? "Receipts folder" : "Inbox fallback"}`);
    } else {
      emails = await fetchReceiptEmails(session.accessToken);
      console.log(`[receipts] Gmail: ${emails.length} emails fetched`);
    }

    let newReceipts = 0;
    const BATCH = 5;
    for (let i = 0; i < emails.length; i += BATCH) {
      const results = await Promise.allSettled(
        emails.slice(i, i + BATCH).map((email) => parseReceiptWithClaude(email))
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.length > 0) {
          await addReceipts(userId, r.value);
          newReceipts += r.value.length;
        }
      }
    }

    const totalStored = await getReceiptCount(userId);
    console.log(`[receipts] user=${userId} scanned=${emails.length} newReceipts=${newReceipts} stored=${totalStored}`);
    return NextResponse.json({ scanned: emails.length, newReceipts, totalStored });
  } catch (err) {
    console.error(`[receipts] POST crashed for ${userId}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Receipt scan failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.email;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const receipts = await getReceipts(userId);
  return NextResponse.json({ receipts, count: receipts.length });
}
