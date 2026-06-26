import Anthropic from "@anthropic-ai/sdk";
import { Deal, Category, OfferType, DealColor, ConfidenceScore } from "@/types/deal";

const client = new Anthropic();

function generateId(): string {
  return `deal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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
  return 15; // conservative default when original price is unknown
}

export interface RawEmail {
  subject: string;
  body: string;
  receivedAt: string;
  senderEmail: string;
  senderDomain: string;
  messageId?: string;
}

export async function parseEmailWithClaude(email: RawEmail): Promise<Deal[]> {
  const prompt = `You are a promotional email parser. Extract all deals from this promotional email and return them as a JSON array.

Email Subject: ${email.subject}
Received At: ${email.receivedAt}
Sender Domain: ${email.senderDomain}

Email Body:
${email.body}

Extract each distinct offer as a separate object. For each deal, return:
{
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
  "notes": "Specific product names and offer details — e.g. '$1.29 off any size Premium Roast or Iced Coffee, app orders only' or 'Buy one get one free on all organic salads'. Do NOT just repeat the discount amount; include WHAT the deal applies to.",
  "brands": array of brand names featured in the deal (empty array if none),
  "codeInImage": boolean,
  "isEvergreen": boolean — true ONLY when the email explicitly says the offer never expires, is always available, or is ongoing (e.g. "no expiration date", "always available", "ongoing offer"). Set false when the expiry is simply not mentioned.
}

Rules:
- NEVER fabricate deals — only extract what's explicitly stated
- For relative expiration ("today only", "48 hours") compute absolute date from receivedAt timestamp
- If expiry is unclear, set expirationDate to null
- isEvergreen must be false unless the email explicitly states perpetual availability
- Deduplicate if the same offer appears multiple times
- Return [] if no valid promotional deals found

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

    return parsed.map((raw: Record<string, unknown>) => {
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
      const qualityScore =
        confidence === "high" ? 80 + Math.floor(Math.random() * 20) :
        confidence === "medium" ? 55 + Math.floor(Math.random() * 20) :
        30 + Math.floor(Math.random() * 25);

      return {
        id: generateId(),
        retailer,
        retailerNormalized: retailer.toLowerCase().replace(/[^a-z0-9]/g, ""),
        category: (raw.category as Category) || "Other / Uncategorized",
        offerType,
        dealColor: color,
        discountValue,
        discountUnit: discountUnit as Deal["discountUnit"],
        promoCode: (raw.promoCode as string | null) || null,
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
        brands: (raw.brands as string[]) || [],
        codeInImage: (raw.codeInImage as boolean) || false,
      } satisfies Deal;
    });
  } catch {
    return [];
  }
}
