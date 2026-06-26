import { Deal } from "@/types/deal";

export const mockDeals: Deal[] = [];

export function getActiveDeals(): Deal[] {
  return mockDeals.filter((d) => d.status === "active");
}

export function getExpiringDeals(): Deal[] {
  return mockDeals.filter((d) => d.urgency === "urgent" && d.status === "active");
}

export function getEvergreenDeals(): Deal[] {
  return mockDeals.filter((d) => d.urgency === "evergreen" && d.status === "active");
}

export function getTop10Deals(): Deal[] {
  return getActiveDeals()
    .filter((d) => d.urgency !== "evergreen" && d.expirationStatus !== "expired")
    .sort((a, b) => b.effectiveDiscountPercent - a.effectiveDiscountPercent)
    .slice(0, 10);
}

export function getDashboardStats() {
  const active = getActiveDeals();
  const categories = new Set(active.map((d) => d.category));
  const estimatedSavings = active.reduce((sum, d) => {
    if (d.discountUnit === "percent") return sum + d.discountValue * 5;
    if (d.discountUnit === "dollars") return sum + d.discountValue;
    return sum + 25;
  }, 0);

  return {
    totalActive: active.length,
    expiringToday: active.filter((d) => d.urgency === "urgent").length,
    categoriesCount: categories.size,
    estimatedSavings: Math.round(estimatedSavings),
  };
}
