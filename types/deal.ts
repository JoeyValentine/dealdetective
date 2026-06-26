export type OfferType =
  | "percentage_off"
  | "dollar_off"
  | "bogo"
  | "free_shipping"
  | "freebie"
  | "clearance_sale";

export type DealColor =
  | "blue"
  | "purple"
  | "green"
  | "orange"
  | "teal"
  | "yellow";

export type ExpirationStatus = "active" | "expiring_soon" | "expired" | "no_expiry";

export type Urgency = "normal" | "urgent" | "evergreen";

export type ConfidenceScore = "high" | "medium" | "low";

export type DealStatus = "active" | "used" | "archived";

export type Category =
  | "Beauty & Cosmetics"
  | "Grocery & Food"
  | "Clothing & Apparel"
  | "Health & Wellness"
  | "Subscriptions & SaaS"
  | "Home & General Retail"
  | "Travel & Dining"
  | "Tech & Electronics"
  | "Fast Food & Restaurants"
  | "Other / Uncategorized";

export interface Deal {
  id: string;
  retailer: string;
  retailerNormalized: string;
  category: Category;
  offerType: OfferType;
  dealColor: DealColor;
  discountValue: number;
  discountUnit: "percent" | "dollars" | "bogo" | "free";
  promoCode: string | null;
  minimumSpend: number | null;
  restrictions: string | null;
  expirationDate: string | null;
  expirationStatus: ExpirationStatus;
  urgency: Urgency;
  confidenceScore: ConfidenceScore;
  sourceEmail: {
    subject: string;
    receivedAt: string;
    senderDomain?: string;
    messageId?: string;
  };
  status: DealStatus;
  qualityScore: number;
  effectiveDiscountPercent: number;
  notes: string;
  codeInImage?: boolean;
  brands?: string[];
  isRepeatable?: boolean;
  repeatFrequency?: string | null; // e.g. "1x only", "daily", "weekly", "monthly"
}

export interface SearchResult {
  deals: Deal[];
  query: string;
  totalCount: number;
}

export interface DashboardStats {
  totalActive: number;
  expiringToday: number;
  categoriesCount: number;
  estimatedSavings: number;
}
