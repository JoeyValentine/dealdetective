export type ReceiptCategory =
  | "Shopping"
  | "Food & Dining"
  | "Travel"
  | "Entertainment"
  | "Health"
  | "Tech"
  | "Other";

export type ReceiptConfidence = "high" | "medium" | "low";

export interface Receipt {
  id: string;
  merchant: string;
  merchantNormalized: string;
  amount: number;
  currency: string;
  orderDate: string | null;
  orderNumber: string | null;
  category: ReceiptCategory;
  itemsSummary: string;
  confidenceScore: ReceiptConfidence;
  emailId: string;
  emailLink: string;
  sourceEmail: {
    subject: string;
    receivedAt: string;
    senderDomain?: string;
  };
}
