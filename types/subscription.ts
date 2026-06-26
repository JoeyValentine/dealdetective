export type SubscriptionFrequency = "monthly" | "annual" | "weekly" | "unknown";

export type SubscriptionCategory =
  | "Entertainment"
  | "Health"
  | "SaaS"
  | "Utilities"
  | "Food"
  | "Other";

export type SubscriptionStatus = "active" | "cancelled" | "unknown";
export type SubscriptionConfidence = "high" | "medium" | "low";

export interface Subscription {
  id: string;
  serviceName: string;
  serviceNormalized: string;
  amount: number;
  currency: string;
  frequency: SubscriptionFrequency;
  category: SubscriptionCategory;
  status: SubscriptionStatus;
  lastBilledDate: string | null;
  nextBillingDate: string | null;
  confidenceScore: SubscriptionConfidence;
  sourceEmail: {
    subject: string;
    receivedAt: string;
    senderDomain?: string;
    messageId?: string;
  };
  notes: string;
}
