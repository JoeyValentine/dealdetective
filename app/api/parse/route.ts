import { NextRequest, NextResponse } from "next/server";
import { parseEmailWithClaude } from "@/lib/parser";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { subject, body: emailBody, receivedAt, senderEmail, senderDomain } = body;

    if (!emailBody) {
      return NextResponse.json({ error: "Email body required" }, { status: 400 });
    }

    const deals = await parseEmailWithClaude({
      subject: subject || "(no subject)",
      body: emailBody,
      receivedAt: receivedAt || new Date().toISOString(),
      senderEmail: senderEmail || "",
      senderDomain: senderDomain || "",
    });

    return NextResponse.json({ deals, count: deals.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parsing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
