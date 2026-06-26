import { NextResponse } from "next/server";
import { getRealDeals, getStoreCount } from "@/lib/dealStore";

export async function GET() {
  const deals = getRealDeals();
  console.log("[/api/gmail/deals] returning", deals.length, "real deals from store");
  return NextResponse.json({ deals, count: deals.length });
}
