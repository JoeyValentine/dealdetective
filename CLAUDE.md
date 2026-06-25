@AGENTS.md

# DealDetective / DealRadar

AI-powered promotional email analyzer. Parses promo emails with Claude, extracts structured deal data, and presents a ranked deal feed with urgency signals and search.

---

## Project Goals

1. Connect to a user's email inbox and ingest promotional emails automatically.
2. Use Claude to parse each email and extract structured deal objects (discount value, promo code, expiry, retailer, category, etc.).
3. Surface deals in a clean dashboard: ranked by urgency and discount quality, filterable by category and minimum discount.
4. Never modify emails, never auto-apply codes — read-only intel tool.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.9 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| AI | `@anthropic-ai/sdk` → `claude-sonnet-4-6` |
| Icons | `lucide-react` |
| Utilities | `clsx` |
| Runtime | Node.js / Vercel edge-compatible |

No database, no auth, no ORM — MVP runs entirely on mock data and stateless API routes.

---

## File Map

```
app/
  page.tsx              — Main dashboard (deals feed, stats, expiring shelf, evergreen shelf)
  layout.tsx            — Root layout
  search/page.tsx       — Full-featured search page with category/discount/expired filters
  api/
    deals/route.ts      — GET /api/deals — query, filter, rank deals from mock data
    parse/route.ts      — POST /api/parse — accepts raw email JSON, returns parsed Deal[]

lib/
  parser.ts             — parseEmailWithClaude(): calls Claude, maps response → Deal[]
  ranker.ts             — rankDeals(), searchDeals(), getExpiryCountdown()
  mockData.ts           — 30 seeded deals across all categories; helper query functions

types/
  deal.ts               — All shared types: Deal, Category, OfferType, DealColor, etc.

components/
  DealCard.tsx          — Card rendering a single deal (compact + full variants)
  TopSteals.tsx         — Horizontal top-10 strip sorted by effectiveDiscountPercent
  CategoryTabs.tsx      — Pill tabs for category filtering with counts
  SearchBar.tsx         — Controlled search input
  StatsBar.tsx          — Summary row: total active, expiring today, categories, estimated savings
  ExpiryBadge.tsx       — Color-coded expiry chip (red/amber/green/gray)
  ConfidenceBadge.tsx   — AI confidence indicator (high/medium/low)
```

---

## Core Data Model (`types/deal.ts`)

```ts
interface Deal {
  id: string
  retailer: string                    // display name, e.g. "Sephora"
  retailerNormalized: string          // lowercase slug, e.g. "sephora"
  category: Category                  // one of 10 fixed categories
  offerType: OfferType                // percentage_off | dollar_off | bogo | free_shipping | freebie | clearance_sale
  dealColor: DealColor                // visual tag: blue | purple | green | orange | teal | yellow
  discountValue: number
  discountUnit: "percent" | "dollars" | "bogo" | "free"
  promoCode: string | null
  minimumSpend: number | null
  restrictions: string | null
  expirationDate: string | null       // ISO 8601
  expirationStatus: "active" | "expiring_soon" | "expired" | "no_expiry"
  urgency: "normal" | "urgent" | "evergreen"
  confidenceScore: "high" | "medium" | "low"
  sourceEmail: { subject, receivedAt, senderDomain }
  status: "active" | "used" | "archived"
  qualityScore: number                // 0-100, derived from confidence + randomness
  effectiveDiscountPercent: number    // normalized % for ranking (bogo=50, freebie=100, free_shipping=10)
  notes: string
  brands?: string[]                   // sub-brands featured in the deal
  codeInImage?: boolean               // true when code is embedded in an image (can't be auto-copied)
}
```

**Urgency rules** (computed in `parser.ts` and used for ranking/display):
- `urgent` — expiry within 48 hours
- `evergreen` — no expiration date detected
- `normal` — everything else

---

## AI Parser (`lib/parser.ts`)

`parseEmailWithClaude(email: RawEmail): Promise<Deal[]>`

1. Builds a structured prompt with email subject, body, sender domain, and `receivedAt` timestamp.
2. Sends to `claude-sonnet-4-6` with `max_tokens: 2048`.
3. Strips markdown code fences from the response (Claude wraps JSON in ` ```json ``` `).
4. Parses the JSON array and maps each object to a full `Deal`, computing `dealColor`, `expirationStatus`, `urgency`, and `effectiveDiscountPercent` locally.

**Key parsing rules embedded in prompt:**
- Never fabricate deals — only extract what's explicitly stated.
- Resolve relative expiry dates ("48 hours", "tonight") to absolute ISO timestamps using `receivedAt`.
- Deduplicate repeated offers.
- Return `[]` if no valid promo deals exist.

**API key:** must be set in `.env.local` as `ANTHROPIC_API_KEY=sk-ant-...` (no leading space — this was a bug that was fixed).

---

## API Routes

### `GET /api/deals`
Query the mock deal store.

| Param | Values | Default |
|---|---|---|
| `view` | `active` \| `top10` \| `stats` | `active` |
| `q` | search string | — |
| `category` | any `Category` value | — |
| `minDiscount` | integer 0–100 | `0` |
| `includeExpired` | `true` \| `false` | `false` |

Returns `{ deals: Deal[], total: number }` or `DashboardStats` for `view=stats`.

### `POST /api/parse`
Parse a raw email with Claude.

```json
{
  "subject": "string",
  "body": "string (required)",
  "receivedAt": "ISO 8601",
  "senderEmail": "string",
  "senderDomain": "string"
}
```

Returns `{ deals: Deal[], count: number }`. Returns `503` if `ANTHROPIC_API_KEY` is missing.

---

## Ranking Logic (`lib/ranker.ts`)

`rankDeals()` sort order:
1. `evergreen` sinks to bottom.
2. `urgent` floats to top.
3. Among same urgency: soonest expiry first.
4. Tie-break: highest `effectiveDiscountPercent`.

`searchDeals()` matches against: retailer, retailerNormalized, category, promoCode, notes, brands, offerType.

---

## Dashboard Layout (`app/page.tsx`)

Top → bottom:
1. **StatsBar** — 4 KPI chips.
2. **Expiring Soon** — collapsible section, deals with `urgency === "urgent"`.
3. **Top 10 Steals** — horizontal strip, top 10 by `effectiveDiscountPercent`.
4. **Deals Feed** — filterable grid (category tabs + min discount dropdown).
5. **Always Available Shelf** — collapsible evergreen deals.

---

## Guardrails

- **Read-only** — the app never modifies, replies to, or deletes any email.
- **No auto-apply** — promo codes are displayed for manual use only.
- **No fabrication** — the parser prompt explicitly prohibits inventing deals not present in the email.
- **Confidence signaling** — every deal carries a `confidenceScore` and `codeInImage` flag so users can judge reliability.
- **No auth yet** — the MVP runs on mock data; no real inbox connection exists.

---

## What's Built vs. What's Next

### Done
- Full `Deal` type system with all offer types, urgency levels, and color coding.
- Claude-powered email parser (`/api/parse`) — tested and working.
- 30-deal mock dataset covering all 10 categories.
- Dashboard with stats, expiring deals, top steals, category filter, search, min-discount filter, and evergreen shelf.
- Search page (`/search`) with full filter set.
- REST API (`/api/deals`) ready for a future real data layer.

### Not yet built
- Real Gmail / IMAP inbox connection.
- Persistent storage (database).
- User authentication.
- Email ingestion pipeline (webhooks, polling, or scheduled parsing).
- Deal deduplication across sessions.
- Push notifications for expiring deals.
- "Mark as used" / deal status management UI.

---

## Local Dev

```bash
cp .env.example .env.local   # add ANTHROPIC_API_KEY (no leading space)
npm install
npm run dev                  # http://localhost:3000
```

Test the parser directly:
```bash
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{"body":"40% off sitewide, use code SAVE40. Expires June 30.","receivedAt":"2026-06-25T10:00:00Z","senderDomain":"example.com"}'
```
