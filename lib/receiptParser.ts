import Anthropic from "@anthropic-ai/sdk";
import { Receipt, ReceiptCategory, ReceiptConfidence } from "@/types/receipt";
import { RawEmail } from "@/lib/parser";

const client = new Anthropic();

export async function parseReceiptWithClaude(email: RawEmail): Promise<Receipt[]> {
  const prompt = `You are a purchase receipt email parser. Extract completed one-time transactions from this email.

Email Subject: ${email.subject}
Received At: ${email.receivedAt}
Sender Domain: ${email.senderDomain}

Email Body:
${email.body}

If this email is an order confirmation, purchase receipt, or payment confirmation for a completed one-time transaction, return a JSON array. For each purchase:
{
  "merchant": "Exact merchant or store name (e.g. 'Amazon', 'Apple', 'Target')",
  "amount": number in dollars (e.g. 29.99) — the total amount charged,
  "currency": "USD" or detected currency code,
  "orderDate": "ISO 8601 date of the purchase" or null,
  "orderNumber": "order or transaction ID string" or null,
  "category": one of ["Shopping","Food & Dining","Travel","Entertainment","Health","Tech","Other"],
  "itemsSummary": "Brief description of what was purchased e.g. '2x Blue T-Shirt, 1x Jeans' or 'iPhone case'",
  "confidenceScore": "high" if merchant and amount are explicit, "medium" if one is uncertain, "low" if both are unclear
}

Rules:
- Return [] if this is NOT a completed transaction (promotional offers, recurring subscription billing, shipping-only updates, newsletters, password resets)
- Return [] for $0 orders or free trials
- NEVER fabricate amounts — only extract what is explicitly stated
- One entry per distinct order/transaction if multiple appear in the email

Return ONLY a valid JSON array, no other text.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") return [];

  // Same defensive JSON extraction as subscriptionParser: first fenced block wins,
  // fall back to first-[-to-last-] extraction when no fences are present.
  const fenceMatch = content.text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let json: string;
  if (fenceMatch) {
    json = fenceMatch[1].trim();
  } else {
    const t = content.text.trim();
    const arrStart = t.indexOf("[");
    const arrEnd = t.lastIndexOf("]");
    json = arrStart !== -1 && arrEnd > arrStart ? t.slice(arrStart, arrEnd + 1) : t;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    console.error(`[receiptParser] JSON.parse failed for "${email.subject}". Raw:\n${content.text.slice(0, 1000)}`);
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const emailLink =
    email.emailLink ??
    (email.messageId ? `https://mail.google.com/mail/u/0/#inbox/${email.messageId}` : "");

  return (parsed as Record<string, unknown>[])
    .filter((raw) => {
      if (!raw.merchant || typeof raw.amount !== "number") return false;
      const amt = raw.amount as number;
      return amt > 0 && amt <= 50000;
    })
    .map((raw) => {
      const merchant = (raw.merchant as string) || "Unknown";
      return {
        id: `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        merchant,
        merchantNormalized: merchant.toLowerCase().replace(/[^a-z0-9]/g, ""),
        amount: raw.amount as number,
        currency: (raw.currency as string) || "USD",
        orderDate: (raw.orderDate as string | null) || null,
        orderNumber: (raw.orderNumber as string | null) || null,
        category: (raw.category as ReceiptCategory) || "Other",
        itemsSummary: (raw.itemsSummary as string) || "",
        confidenceScore: (raw.confidenceScore as ReceiptConfidence) || "medium",
        emailId: email.messageId ?? "",
        emailLink,
        sourceEmail: {
          subject: email.subject,
          receivedAt: email.receivedAt,
          senderDomain: email.senderDomain,
        },
      } satisfies Receipt;
    });
}
