import { RawEmail } from "@/lib/parser";

const GRAPH_API = "https://graph.microsoft.com/v1.0";
const PROMO_RE = /(\d+\s*%|% off|\$\d+\s*off|save|deal|promo|free|discount|sale|code|coupon|offer|bogo)/i;
const BILLING_KEYWORDS = ["invoice", "receipt", "billing", "subscription", "renewal", "payment", "statement"];

interface GraphMessage {
  id: string;
  subject: string;
  receivedDateTime: string;
  from: { emailAddress: { address: string; name: string } };
  body: { content: string; contentType: string };
  webLink?: string;
}

interface GraphPage {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function graphGet<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Graph API ${res.status}: ${url}`);
  return res.json();
}

function toRawEmail(msg: GraphMessage): RawEmail | null {
  const rawBody = msg.body?.content ?? "";
  const body = msg.body?.contentType === "html" ? stripHtml(rawBody) : rawBody;
  if (!body.trim()) return null;
  const senderEmail = msg.from?.emailAddress?.address ?? "";
  const senderDomain = senderEmail.split("@")[1] ?? "";
  return {
    subject: msg.subject ?? "(no subject)",
    body: body.slice(0, 8000),
    receivedAt: msg.receivedDateTime,
    senderEmail,
    senderDomain,
    messageId: msg.id,
  };
}

const INBOX_BASE = `${GRAPH_API}/me/mailFolders/Inbox/messages?$select=id,subject,body,receivedDateTime,from&$orderby=receivedDateTime desc`;

// pageToken is the full @odata.nextLink URL from the previous response
export async function fetchOutlookPromoPage(
  accessToken: string,
  pageToken?: string,
  pageSize = 100
): Promise<{ emails: RawEmail[]; nextPageToken?: string; count: number }> {
  const url = pageToken ?? `${INBOX_BASE}&$top=${pageSize}`;
  const page = await graphGet<GraphPage>(url, accessToken);
  const messages = page.value ?? [];
  const count = messages.length;

  if (count === 0) return { emails: [], nextPageToken: page["@odata.nextLink"], count: 0 };

  const emails: RawEmail[] = [];
  for (const msg of messages) {
    if (!PROMO_RE.test(msg.subject ?? "")) continue;
    const email = toRawEmail(msg);
    if (email) emails.push(email);
  }

  return { emails, nextPageToken: page["@odata.nextLink"], count };
}

export async function fetchOutlookBillingEmails(
  accessToken: string,
  maxFetch = 500
): Promise<RawEmail[]> {
  const emails: RawEmail[] = [];
  let pageUrl: string | undefined = `${INBOX_BASE}&$top=100`;

  while (pageUrl && emails.length < maxFetch) {
    const page: GraphPage = await graphGet<GraphPage>(pageUrl, accessToken);
    for (const msg of page.value ?? []) {
      const subjectLower = (msg.subject ?? "").toLowerCase();
      if (BILLING_KEYWORDS.some((k) => subjectLower.includes(k))) {
        const email = toRawEmail(msg);
        if (email) emails.push(email);
      }
    }
    pageUrl = page["@odata.nextLink"];
  }

  return emails;
}

// Converts a GraphMessage to RawEmail, capturing webLink for receipt deep-links.
// Kept separate from toRawEmail so billing/promo paths are unaffected.
function toRawEmailWithLink(msg: GraphMessage): RawEmail | null {
  const rawBody = msg.body?.content ?? "";
  const body = msg.body?.contentType === "html" ? stripHtml(rawBody) : rawBody;
  if (!body.trim()) return null;
  const senderEmail = msg.from?.emailAddress?.address ?? "";
  const senderDomain = senderEmail.split("@")[1] ?? "";
  return {
    subject: msg.subject ?? "(no subject)",
    body: body.slice(0, 8000),
    receivedAt: msg.receivedDateTime,
    senderEmail,
    senderDomain,
    messageId: msg.id,
    emailLink: msg.webLink,
  };
}

const RECEIPT_SELECT = "$select=id,subject,body,receivedDateTime,from,webLink";
const RECEIPT_KEYWORDS = ["order", "receipt", "confirmation", "purchase", "invoice"];

export async function fetchOutlookReceiptEmails(
  accessToken: string,
  maxFetch = 500
): Promise<{ emails: RawEmail[]; usedReceiptsFolder: boolean }> {
  // Try to find a "Receipts" folder by displayName
  const foldersRes = await graphGet<{ value: { id: string; displayName: string }[] }>(
    `${GRAPH_API}/me/mailFolders?$select=id,displayName&$top=100`,
    accessToken
  );
  const receiptsFolder = (foldersRes.value ?? []).find(
    (f) => f.displayName.toLowerCase() === "receipts"
  );

  if (receiptsFolder) {
    console.log(`[outlookFetcher] Found Receipts folder id=${receiptsFolder.id} — fetching all messages`);
    const emails: RawEmail[] = [];
    let pageUrl: string | undefined =
      `${GRAPH_API}/me/mailFolders/${receiptsFolder.id}/messages?${RECEIPT_SELECT}&$orderby=receivedDateTime desc&$top=100`;
    while (pageUrl && emails.length < maxFetch) {
      const page: GraphPage = await graphGet<GraphPage>(pageUrl, accessToken);
      for (const msg of page.value ?? []) {
        const email = toRawEmailWithLink(msg);
        if (email) emails.push(email);
      }
      pageUrl = page["@odata.nextLink"];
    }
    return { emails, usedReceiptsFolder: true };
  }

  // Fallback: scan Inbox with keyword subject filter
  console.log(`[outlookFetcher] No Receipts folder — falling back to Inbox keyword filter`);
  const emails: RawEmail[] = [];
  let pageUrl: string | undefined =
    `${GRAPH_API}/me/mailFolders/Inbox/messages?${RECEIPT_SELECT}&$orderby=receivedDateTime desc&$top=100`;
  while (pageUrl && emails.length < maxFetch) {
    const page: GraphPage = await graphGet<GraphPage>(pageUrl, accessToken);
    for (const msg of page.value ?? []) {
      const subjectLower = (msg.subject ?? "").toLowerCase();
      if (RECEIPT_KEYWORDS.some((k) => subjectLower.includes(k))) {
        const email = toRawEmailWithLink(msg);
        if (email) emails.push(email);
      }
    }
    pageUrl = page["@odata.nextLink"];
  }
  return { emails, usedReceiptsFolder: false };
}
