import { NextRequest, NextResponse } from "next/server";
import { getActiveDeals, getTop10Deals, getDashboardStats } from "@/lib/mockData";
import { searchDeals, rankDeals } from "@/lib/ranker";
import { getRealDeals } from "@/lib/dealStore";
import { Category } from "@/types/deal";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "active";
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") as Category | "All" | null;
  const minDiscount = parseInt(searchParams.get("minDiscount") || "0");
  const includeExpired = searchParams.get("includeExpired") === "true";

  const realDeals = getRealDeals();
  // When real deals exist, surface them first alongside mock data
  const activeDeals = realDeals.length > 0
    ? [...realDeals, ...getActiveDeals()]
    : getActiveDeals();

  let deals = view === "top10"
    ? activeDeals.sort((a, b) => b.effectiveDiscountPercent - a.effectiveDiscountPercent).slice(0, 10)
    : view === "stats"
    ? []
    : activeDeals;

  if (view === "stats") {
    return NextResponse.json(getDashboardStats());
  }

  if (q) {
    deals = searchDeals(deals, q);
  }

  if (category && category !== "All") {
    deals = deals.filter((d) => d.category === category);
  }

  if (minDiscount > 0) {
    deals = deals.filter((d) => d.effectiveDiscountPercent >= minDiscount);
  }

  if (!includeExpired) {
    deals = deals.filter((d) => d.expirationStatus !== "expired");
  }

  const ranked = rankDeals(deals);

  return NextResponse.json({ deals: ranked, total: ranked.length });
}
