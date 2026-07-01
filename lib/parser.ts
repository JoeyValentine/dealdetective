import Anthropic from "@anthropic-ai/sdk";
import { Deal, Category, OfferType, DealColor, ConfidenceScore } from "@/types/deal";

const client = new Anthropic();

function generateId(): string {
  return `deal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const KNOWN_BRANDS = ['amazon', 'apple', 'nike', 'adidas', 'target', 'walmart', 'levis', 'zara', 'handm', 'spotify', 'netflix', 'google', 'microsoft', 'anthropic', 'uber', 'doordash'];

function offerTypeToColor(offerType: OfferType, discountValue: number): DealColor {
  if (offerType === "bogo") return "green";
  if (offerType === "free_shipping" || offerType === "freebie") return "teal";
  if (offerType === "clearance_sale") return "yellow";
  if (offerType === "dollar_off") return "orange";
  if (offerType === "percentage_off") {
    return discountValue >= 50 ? "purple" : "blue";
  }
  return "blue";
}

function computeEffectivePercent(offerType: OfferType, discountValue: number, discountUnit: string, minimumSpend?: number | null): number {
  if (discountUnit === "percent") return discountValue;
  if (offerType === "bogo") return 50;
  if (offerType === "freebie") return 100;
  if (offerType === "free_shipping") return 10;
  if (discountUnit === "dollars" && minimumSpend && minimumSpend > 0) {
    return Math.min(Math.round((discountValue / minimumSpend) * 100), 90);
  }
  return 15;
}

export interface RawEmail {
  subject: string;
  body: string;
  receivedAt: string;
  senderEmail: string;
  senderDomain: string;
  messageId?: string;
}

function mapRawToDeal(raw: Record<string, unknown>, email: RawEmail): Deal {
  const offerType = (raw.offerType as OfferType) || "percentage_off";
  const discountValue = (raw.discountValue as number) || 0;
  const discountUnit = (raw.discountUnit as string) || "percent";
  const retailer = (raw.retailer as string) || "Unknown";
  const minimumSpend = (raw.minimumSpend as number | null) || null;

  const color = offerTypeToColor(offerType, discountValue);
  const effectivePct = computeEffectivePercent(offerType, discountValue, discountUnit, minimumSpend);

  const expirationDate = (raw.expirationDate as string | null) || null;
  let expirationStatus: Deal["expirationStatus"] = "no_expiry";
  let urgency: Deal["urgency"] = "normal";

  if (expirationDate) {
    const now = new Date();
    const exp = new Date(expirationDate);
    const diffHours = (exp.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours <= 0) {
      expirationStatus = "expired";
      urgency = "normal";
    } else if (diffHours <= 48) {
      expirationStatus = "expiring_soon";
      urgency = "urgent";
    } else {
      expirationStatus = "active";
      urgency = "normal";
    }
  } else if (raw.isEvergreen === true) {
    urgency = "evergreen";
  }

  const confidence = (raw.confidenceScore as ConfidenceScore) || "medium";
  const promoCode = (raw.promoCode as string | null) || null;
  const brands = (raw.brands as string[]) || [];

  const retailerSlug = retailer.toLowerCase().replace(/[^a-z0-9]/g, "");
  let qualityScore = 1;
  qualityScore += Math.min(5, Math.floor(effectivePct / 10));
  if (urgency === "urgent") qualityScore += 1;
  if (promoCode) qualityScore += 1;
  if (brands.length > 0) qualityScore += 1;
  if (confidence === "high") qualityScore += 1;
  if (KNOWN_BRANDS.some((b) => retailerSlug.includes(b))) qualityScore += 1;
  if (confidence === "low") qualityScore -= 1;
  qualityScore = Math.min(10, Math.max(1, qualityScore));

  return {
    id: generateId(),
    retailer,
    retailerNormalized: retailer.toLowerCase().replace(/[^a-z0-9]/g, ""),
    category: (raw.category as Category) || "Other / Uncategorized",
    offerType,
    dealColor: color,
    discountValue,
    discountUnit: discountUnit as Deal["discountUnit"],
    promoCode,
    minimumSpend,
    restrictions: (raw.restrictions as string | null) || null,
    expirationDate,
    expirationStatus,
    urgency,
    confidenceScore: confidence,
    sourceEmail: {
      subject: email.subject,
      receivedAt: email.receivedAt,
      senderDomain: email.senderDomain,
      messageId: email.messageId,
    },
    status: expirationStatus === "expired" ? "archived" : "active",
    qualityScore,
    effectiveDiscountPercent: effectivePct,
    notes: (raw.notes as string) || "",
    brands,
    codeInImage: (raw.codeInImage as boolean) || false,
    isRepeatable: raw.isRepeatable === true,
    repeatFrequency: (raw.repeatFrequency as string | null) || null,
  } satisfies Deal;
}

const DEAL_FIELDS = `{
  "retailer": "Brand name (normalized)",
  "category": one of ["Beauty & Cosmetics","Grocery & Food","Clothing & Apparel","Health & Wellness","Subscriptions & SaaS","Home & General Retail","Travel & Dining","Tech & Electronics","Fast Food & Restaurants","Other / Uncategorized"],
  "offerType": one of ["percentage_off","dollar_off","bogo","free_shipping","freebie","clearance_sale"],
  "discountValue": number (0 if not applicable),
  "discountUnit": one of ["percent","dollars","bogo","free"],
  "promoCode": string or null,
  "minimumSpend": number or null,
  "restrictions": string or null,
  "expirationDate": ISO 8601 datetime string or null (compute absolute date from receivedAt for relative dates like "48 hours"),
  "confidenceScore": one of ["high","medium","low"],
  "notes": "Specific product names and offer details — e.g. '$1.29 off any size Premium Roast or Iced Coffee, app orders only'. Do NOT just repeat the discount amount; include WHAT the deal applies to.",
  "brands": array of brand names featured in the deal (empty array if none),
  "codeInImage": boolean,
  "isEvergreen": boolean — true ONLY when the email explicitly says the offer never expires, is always available, or is ongoing,
  "isRepeatable": boolean — true when the deal can be used more than once,
  "repeatFrequency": string or null — only when explicitly stated: "daily", "weekly", "monthly", etc.
}`;

const DEAL_RULES = `Rules:
- NEVER fabricate deals — only extract what's explicitly stated
- For relative expiration ("today only", "48 hours") compute absolute date from receivedAt timestamp
- If expiry is unclear, set expirationDate to null
- isEvergreen must be false unless the email explicitly states perpetual availability
- Deduplicate if the same offer appears multiple times
- Return [] if no valid promotional deals found`;

export async function parseEmailWithClaude(email: RawEmail): Promise<Deal[]> {
  const prompt = `You are a promotional email parser. Extract all deals from this promotional email and return them as a JSON array.

Email Subject: ${email.subject}
Received At: ${email.receivedAt}
Sender Domain: ${email.senderDomain}

Email Body:
${email.body}

Extract each distinct offer as a separate object:
${DEAL_FIELDS}

${DEAL_RULES}

Return ONLY a valid JSON array, no other text.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") return [];

  try {
    const json = content.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((raw: Record<string, unknown>) => mapRawToDeal(raw, email));
  } catch {
    return [];
  }
}

export async function parseEmailsBatchWithClaude(emails: RawEmail[]): Promise<Deal[]> {
  if (emails.length === 0) return [];

  const emailsText = emails
    .map((e, i) =>
      `--- EMAIL ${i + 1} ---\nSubject: ${e.subject}\nReceived At: ${e.receivedAt}\nSender Domain: ${e.senderDomain}\n\nBody:\n${e.body}`
    )
    .join("\n\n");

  const prompt = `You are a promotional email parser. Extract all deals from these ${emails.length} emails.

${emailsText}

For each deal found, add "emailIndex" (1-based integer indicating which email above it came from). Return:
{
  "emailIndex": number,
  "retailer": "Brand name (normalized)",
  "category": one of ["Beauty & Cosmetics","Grocery & Food","Clothing & Apparel","Health & Wellness","Subscriptions & SaaS","Home & General Retail","Travel & Dining","Tech & Electronics","Fast Food & Restaurants","Other / Uncategorized"],
  "offerType": one of ["percentage_off","dollar_off","bogo","free_shipping","freebie","clearance_sale"],
  "discountValue": number (0 if not applicable),
  "discountUnit": one of ["percent","dollars","bogo","free"],
  "promoCode": string or null,
  "minimumSpend": number or null,
  "restrictions": string or null,
  "expirationDate": ISO 8601 datetime string or null (compute absolute date from each email's Received At for relative dates),
  "confidenceScore": one of ["high","medium","low"],
  "notes": "Specific product names and offer details. Do NOT just repeat the discount amount; include WHAT the deal applies to.",
  "brands": array of brand names (empty array if none),
  "codeInImage": boolean,
  "isEvergreen": boolean — true ONLY when the email explicitly states no expiration,
  "isRepeatable": boolean,
  "repeatFrequency": string or null
}

${DEAL_RULES}

Return ONLY a valid JSON array, no other text.`;

  console.log('[sync][debug] body chars:', emails.map(e => (e.body || '').length));
  let message: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; error?: unknown };
    console.error('[sync][debug] Claude call failed:', e?.status, e?.message, JSON.stringify(e?.error || err));
    return [];
  }

  const content = message.content[0];
  const rawText = content.type === "text" ? content.text : "";
  console.log('[sync][debug] raw response:', rawText.slice(0, 2000));
  if (content.type !== "text") {
    console.error("[claude] unexpected content type:", content.type, JSON.stringify(content));
    return [];
  }

  // Strip fences then extract outermost [...] to survive prose before/after JSON
  const stripped = content.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const arrStart = stripped.indexOf("[");
  const arrEnd = stripped.lastIndexOf("]");
  const json = arrStart !== -1 && arrEnd > arrStart ? stripped.slice(arrStart, arrEnd + 1) : stripped;
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((raw: Record<string, unknown>) => {
      const idx = Math.max(0, Math.min(((raw.emailIndex as number) || 1) - 1, emails.length - 1));
      return mapRawToDeal(raw, emails[idx]);
    });
  } catch (err) {
    console.error("[claude] JSON parse failed:", err instanceof Error ? err.message : err,
      "| text length:", json.length, "| first 1500:", json.slice(0, 1500));
    return [];
  }
}
