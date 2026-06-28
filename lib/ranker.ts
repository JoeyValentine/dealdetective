import { Deal } from "@/types/deal";

export function rankDeals(deals: Deal[]): Deal[] {
  const now = new Date();

  return [...deals].sort((a, b) => {
    // Evergreen sinks to bottom
    if (a.urgency === "evergreen" && b.urgency !== "evergreen") return 1;
    if (b.urgency === "evergreen" && a.urgency !== "evergreen") return -1;

    // Urgent (expiring ≤48h) floats to top
    if (a.urgency === "urgent" && b.urgency !== "urgent") return -1;
    if (b.urgency === "urgent" && a.urgency !== "urgent") return 1;

    // Sort by expiration date (soonest first)
    const aExp = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
    const bExp = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
    if (aExp !== bExp) return aExp - bExp;

    // Break ties by quality score (highest first)
    return b.qualityScore - a.qualityScore;
  });
}

export function getExpiryCountdown(expirationDate: string | null): {
  label: string;
  color: "green" | "amber" | "red" | "gray";
  hoursRemaining: number | null;
} {
  if (!expirationDate) {
    return { label: "No expiry", color: "gray", hoursRemaining: null };
  }

  const now = new Date();
  const exp = new Date(expirationDate);
  const diffMs = exp.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  if (diffMs <= 0) {
    return { label: "Expired", color: "red", hoursRemaining: 0 };
  }

  if (diffHours <= 48) {
    const h = Math.floor(diffHours);
    const m = Math.floor((diffHours - h) * 60);
    return {
      label: `${h}h ${m}m left`,
      color: "red",
      hoursRemaining: diffHours,
    };
  }

  if (diffDays <= 7) {
    return {
      label: `${Math.floor(diffDays)}d left`,
      color: "amber",
      hoursRemaining: diffHours,
    };
  }

  return {
    label: `${Math.floor(diffDays)}d left`,
    color: "green",
    hoursRemaining: diffHours,
  };
}

export function searchDeals(deals: Deal[], query: string): Deal[] {
  if (!query.trim()) return deals;
  const q = query.toLowerCase();

  return deals.filter((deal) => {
    const inRetailer = deal.retailer.toLowerCase().includes(q);
    const inNormalized = deal.retailerNormalized.toLowerCase().includes(q);
    const inCategory = deal.category.toLowerCase().includes(q);
    const inCode = deal.promoCode?.toLowerCase().includes(q) ?? false;
    const inNotes = deal.notes.toLowerCase().includes(q);
    const inBrands = deal.brands?.some((b) => b.toLowerCase().includes(q)) ?? false;
    const inOfferType = deal.offerType.replace(/_/g, " ").toLowerCase().includes(q);

    return (
      inRetailer || inNormalized || inCategory || inCode || inNotes || inBrands || inOfferType
    );
  });
}
