import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRealDeals } from "@/lib/dealStore";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.email;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const deals = getRealDeals(userId);
  return NextResponse.json({ deals, count: deals.length });
}
