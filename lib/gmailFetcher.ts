import { RawEmail } from "@/lib/parser";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

interface GmailMeta {
  id: string;
  payload: { headers: { name: string; value: string }[] };
}

interface GmailFull extends GmailMeta {
  internalDate: string;
  payload: GmailMeta["payload"] & {
    mimeType: string;
    body?: { data?: string };
    parts?: GmailPart[];
  };
}

interface GmailPart {
  mimeType: string;
  body: { data?: string };
  parts?: GmailPart[];
}

function header(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeB64url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractBody(payload: GmailFull["payload"]): string {
  // Try top-level body
  if (payload.body?.data) {
    const text = decodeB64url(payload.body.data);
    return payload.mimeType === "text/html" ? stripHtml(text) : text;
  }

  if (!payload.parts) return "";

  // Walk MIME parts: prefer text/plain, fall back to text/html
  function walk(parts: GmailPart[]): string {
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body.data) return decodeB64url(part.body.data);
      if (part.parts) {
        const found = walk(part.parts);
        if (found) return found;
      }
    }
    for (const part of parts) {
      if (part.mimeType === "text/html" && part.body.data) return stripHtml(decodeB64url(part.body.data));
      if (part.parts) {
        const found = walk(part.parts);
        if (found) return found;
      }
    }
    return "";
  }

  return walk(payload.parts);
}

async function gmailGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail API ${path} → ${res.status}`);
  return res.json();
}

const BILLING_QUERY = "subject:(invoice OR receipt OR billing OR subscription OR renewal OR payment OR statement)";

function receiptQuery(): string {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const d = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, "0")}/${String(since.getDate()).padStart(2, "0")}`;
  return `subject:(order OR receipt OR confirmation OR purchase OR invoice) after:${d}`;
}

export async function fetchReceiptEmails(
  accessToken: string,
  maxFetch = 500
): Promise<RawEmail[]> {
  const list = await gmailGet<{ messages?: { id: string }[] }>(
    `/users/me/messages?q=${encodeURIComponent(receiptQuery())}&maxResults=${maxFetch}`,
    accessToken
  );
  const ids = list.messages ?? [];

  const FULL_BATCH = 25;
  const emails: RawEmail[] = [];
  for (let i = 0; i < ids.length; i += FULL_BATCH) {
    const results = await Promise.allSettled(
      ids.slice(i, i + FULL_BATCH).map((m) =>
        gmailGet<GmailFull>(`/users/me/messages/${m.id}?format=full`, accessToken)
      )
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const msg = r.value;
      const subject = header(msg.payload.headers, "Subject");
      const from = header(msg.payload.headers, "From");
      const body = extractBody(msg.payload);
      if (!body.trim()) continue;
      const senderEmail = from.match(/<([^>]+)>/)?.[1] ?? from;
      const senderDomain = senderEmail.split("@")[1] ?? "";
      emails.push({
        subject,
        body: body.slice(0, 8000),
        receivedAt: new Date(parseInt(msg.internalDate)).toISOString(),
        senderEmail,
        senderDomain,
        messageId: msg.id,
        emailLink: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
      });
    }
  }

  return emails;
}

export async function fetchBillingEmails(
  accessToken: string,
  maxFetch = 500
): Promise<RawEmail[]> {
  // 1. List message IDs matching billing subjects across all mail
  const list = await gmailGet<{ messages?: { id: string }[] }>(
    `/users/me/messages?q=${encodeURIComponent(BILLING_QUERY)}&maxResults=${maxFetch}`,
    accessToken
  );
  const ids = list.messages ?? [];

  // 2. Fetch metadata in batches of 20
  const META_BATCH = 20;
  const metas: GmailMeta[] = [];
  for (let i = 0; i < ids.length; i += META_BATCH) {
    const batch = ids.slice(i, i + META_BATCH);
    const results = await Promise.allSettled(
      batch.map((m) =>
        gmailGet<GmailMeta>(
          `/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          accessToken
        )
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled") metas.push(r.value);
    }
  }

  // 3. Fetch full bodies in batches of 10
  const FULL_BATCH = 10;
  const emails: RawEmail[] = [];
  for (let i = 0; i < metas.length; i += FULL_BATCH) {
    const batch = metas.slice(i, i + FULL_BATCH);
    const results = await Promise.allSettled(
      batch.map((m) =>
        gmailGet<GmailFull>(`/users/me/messages/${m.id}?format=full`, accessToken)
      )
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const msg = r.value;
      const subject = header(msg.payload.headers, "Subject");
      const from = header(msg.payload.headers, "From");
      const body = extractBody(msg.payload);
      if (!body.trim()) continue;

      const senderEmail = from.match(/<([^>]+)>/)?.[1] ?? from;
      const senderDomain = senderEmail.split("@")[1] ?? "";

      emails.push({
        subject,
        body: body.slice(0, 8000),
        receivedAt: new Date(parseInt(msg.internalDate)).toISOString(),
        senderEmail,
        senderDomain,
        messageId: msg.id,
      });
    }
  }

  return emails;
}

export async function fetchPromoEmailsPage(
  accessToken: string,
  pageToken?: string,
  pageSize = 25
): Promise<{ emails: RawEmail[]; nextPageToken?: string; count: number }> {
  const q = encodeURIComponent("category:promotions");
  const pt = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
  const list = await gmailGet<{ messages?: { id: string }[]; nextPageToken?: string }>(
    `/users/me/messages?q=${q}&maxResults=${pageSize}${pt}`,
    accessToken
  );
  const ids = list.messages ?? [];
  const count = ids.length;

  if (count === 0) return { emails: [], nextPageToken: list.nextPageToken, count: 0 };

  // Skip metadata — Subject/From are in format=full anyway, and the old PROMO_RE subject
  // filter that justified a separate metadata pass has been removed. Go straight to bodies
  // in batches of 25 (25×5=125 quota units/batch, safely under Gmail's 250/s per-user limit).
  const FULL_BATCH = 25;
  const emails: RawEmail[] = [];
  for (let i = 0; i < ids.length; i += FULL_BATCH) {
    const results = await Promise.allSettled(
      ids.slice(i, i + FULL_BATCH).map((m) =>
        gmailGet<GmailFull>(`/users/me/messages/${m.id}?format=full`, accessToken)
      )
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const msg = r.value;
      const subject = header(msg.payload.headers, "Subject");
      const from = header(msg.payload.headers, "From");
      const body = extractBody(msg.payload);
      if (!body.trim()) continue;
      const senderEmail = from.match(/<([^>]+)>/)?.[1] ?? from;
      const senderDomain = senderEmail.split("@")[1] ?? "";
      emails.push({
        subject,
        body: body.slice(0, 8000),
        receivedAt: new Date(parseInt(msg.internalDate)).toISOString(),
        senderEmail,
        senderDomain,
        messageId: msg.id,
      });
    }
  }

  return { emails, nextPageToken: list.nextPageToken, count };
}
