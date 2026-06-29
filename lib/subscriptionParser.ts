import Anthropic from "@anthropic-ai/sdk";
import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionCategory,
  SubscriptionStatus,
  SubscriptionConfidence,
} from "@/types/subscription";
import { RawEmail } from "@/lib/parser";

const client = new Anthropic();

function computeNextBillingDate(
  lastBilledDate: string | null,
  frequency: SubscriptionFrequency
): string | null {
  if (!lastBilledDate || frequency === "unknown") return null;
  try {
    const d = new Date(lastBilledDate);
    if (isNaN(d.getTime())) return null;
    switch (frequency) {
      case "monthly": d.setMonth(d.getMonth() + 1); break;
      case "annual":  d.setFullYear(d.getFullYear() + 1); break;
      case "weekly":  d.setDate(d.getDate() + 7); break;
    }
    return d.toISOString();
  } catch {
    return null;
  }
}

const EDU_KEYWORDS = ['university', 'college', 'tuition', 'school', 'institute'];

export async function parseSubscriptionWithClaude(email: RawEmail): Promise<Subscription[]> {
  const prompt = `You are a subscription and billing email parser. Extract recurring payment/subscription info.

Email Subject: ${email.subject}
Received At: ${email.receivedAt}
Sender Domain: ${email.senderDomain}

Email Body:
${email.body}

If this email is a billing charge, invoice, receipt, renewal confirmation, or cancellation confirmation, return a JSON array. For each billing item:
{
  "serviceName": "Exact service or company name (e.g. 'Netflix', 'Spotify', 'AWS')",
  "amount": number in dollars (e.g. 15.99) — must be the actual charged amount,
  "currency": "USD" or detected currency code,
  "frequency": one of ["monthly","annual","weekly","unknown"],
  "category": one of ["Entertainment","Health","SaaS","Utilities","Food","Other"],
  "status": "active" for charges/renewals/invoices, "cancelled" for cancellation confirmations only,
  "lastBilledDate": "ISO 8601 date this charge occurred" or null,
  "confidenceScore": "high" if amount and service are clear, "medium" if either is uncertain, "low" if both are unclear,
  "notes": "Plan tier or brief detail e.g. 'Standard plan · 2 screens' or 'Annual renewal'"
}

Rules:
- Return [] if this is NOT a billing email (promotional offers, newsletters, password resets, shipping notifications)
- Return [] for $0 free trials unless a future paid amount is explicitly stated
- NEVER guess amounts — confidenceScore must be "low" if amount is not explicitly stated
- "cancelled" status ONLY when email explicitly confirms cancellation
- Return one object per distinct charge line if multiple services billed together

Return ONLY a valid JSON array, no other text.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") return [];

  const cleanJson = (text: string) =>
    text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

  const cleaned = cleanJson(content.text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error(`[subscriptionParser] JSON.parse failed for "${email.subject}". Raw Claude response:\n${content.text}`);
    // Regex fallback: find a [...] block in the cleaned text
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
      console.log(`[subscriptionParser] Regex fallback succeeded for "${email.subject}"`);
    } catch {
      console.error(`[subscriptionParser] Regex fallback also failed for "${email.subject}"`);
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  const kept: Record<string, unknown>[] = [];
  const dropped: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const raw = parsed[i] as Record<string, unknown>;
    if (!raw.serviceName || typeof raw.amount !== "number") {
      dropped.push(`[${i}] missing serviceName or non-numeric amount (got: ${JSON.stringify({ serviceName: raw.serviceName, amount: raw.amount })})`);
      continue;
    }
    const amount = raw.amount as number;
    if (amount <= 0 || amount > 2000) {
      dropped.push(`[${i}] "${raw.serviceName}" amount=${amount} — out of range (must be 0–2000)`);
      continue;
    }
    const name = (raw.serviceName as string).toLowerCase();
    const eduMatch = EDU_KEYWORDS.find((k) => name.includes(k));
    if (eduMatch) {
      dropped.push(`[${i}] "${raw.serviceName}" — matched EDU keyword "${eduMatch}"`);
      continue;
    }
    kept.push(raw);
  }

  console.log(`[subscriptionParser] "${email.subject.slice(0, 60)}" → candidates=${parsed.length} kept=${kept.length} dropped=${dropped.length}`);
  if (dropped.length > 0) console.log(`[subscriptionParser] dropped:`, dropped);

  return kept.map((raw) => {
    const serviceName = (raw.serviceName as string) || "Unknown";
    const frequency = (raw.frequency as SubscriptionFrequency) || "unknown";
    const lastBilledDate = (raw.lastBilledDate as string | null) || null;
    return {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      serviceName,
      serviceNormalized: serviceName.toLowerCase().replace(/[^a-z0-9]/g, ""),
      amount: raw.amount as number,
      currency: (raw.currency as string) || "USD",
      frequency,
      category: (raw.category as SubscriptionCategory) || "Other",
      status: (raw.status as SubscriptionStatus) || "active",
      lastBilledDate,
      nextBillingDate: computeNextBillingDate(lastBilledDate, frequency),
      confidenceScore: (raw.confidenceScore as SubscriptionConfidence) || "medium",
      sourceEmail: {
        subject: email.subject,
        receivedAt: email.receivedAt,
        senderDomain: email.senderDomain,
        messageId: email.messageId,
      },
      notes: (raw.notes as string) || "",
    } satisfies Subscription;
  });
}
