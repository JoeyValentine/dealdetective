@AGENTS.md

# DealDetective / DealRadar

AI-powered promotional email analyzer and subscription tracker. Parses promo emails with Claude, extracts structured deal data, scans billing emails for recurring charges, and presents a two-panel dashboard — deals on the right, subscriptions on the left.

---

## Project Goals

1. Connect to a user's Gmail inbox (read-only) and ingest promotional and billing emails automatically.
2. Use Claude to parse each email: extract structured Deal objects from promo emails, and Subscription objects from billing emails.
3. Surface deals in a clean dashboard: ranked by urgency and discount quality, filterable by category and minimum discount.
4. Surface subscriptions in a sidebar: monthly total, upcoming payments, active/cancelled list.
5. Never modify emails, never auto-apply codes — read-only intel tool.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.9 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4.3.1 |
| AI | `@anthropic-ai/sdk` → `claude-sonnet-4-6` |
| Auth | `next-auth` v5.0.0-beta.31 + `@auth/core` |
| Icons | `lucide-react` |
| Utilities | `clsx` |
| Runtime | Node.js / Vercel edge-compatible |

No database, no ORM — runs on in-memory stores using globalThis singleton pattern.

---

## File Map

```
app/
  page.tsx                  — Main dashboard (two-column desktop, mobile tabs)
  layout.tsx                — Root layout with no-FOUC dark mode inline script
  search/page.tsx           — Full-featured search page with category/discount/expired filters
  api/
    deals/route.ts          — GET /api/deals — query mock store (kept for /search compat)
    parse/route.ts          — POST /api/parse — accepts raw email JSON, returns parsed Deal[]
    gmail/
      sync/route.ts         — POST: fetch + parse promo emails into dealStore; GET: return all deals
      deals/route.ts        — GET /api/gmail/deals — return dealStore contents
      subscriptions/route.ts — POST: fetch + parse billing emails; GET: return subscriptionStore

lib/
  auth.ts                   — next-auth config: Google provider, gmail.readonly scope, accessToken in JWT
  parser.ts                 — parseEmailWithClaude() + computeEffectivePercent()
  subscriptionParser.ts     — parseSubscriptionWithClaude() + computeNextBillingDate()
  gmailFetcher.ts           — fetchPromoEmailsPage() (paginated, 25/page) + fetchPromoEmails() (legacy) + fetchBillingEmails()
  dealStore.ts              — globalThis singleton Map<string, Deal>
  subscriptionStore.ts      — globalThis singleton Map<string, Subscription>
  ranker.ts                 — rankDeals(), searchDeals(), getExpiryCountdown()
  mockData.ts               — empty mockDeals array; helper fns kept for /api/deals compat

types/
  deal.ts                   — All shared deal types: Deal, Category, OfferType, DealColor, RawEmail, etc.
  subscription.ts           — Subscription, SubscriptionFrequency, SubscriptionCategory, etc.

components/
  DealCard.tsx              — Card rendering a single deal; gradient bg; repeat badge; copy code button; quality score badge; Gmail link
  TopSteals.tsx             — Horizontal top-10 strip sorted by qualityScore
  SubscriptionSidebar.tsx   — Subscription panel: hero stat, analytics, upcoming, active, cancelled; clickable deduplicated alerts
  GmailConnect.tsx          — Stateless display component; receives scanState/foundCount/elapsed/scanResult/onScan as props from page.tsx
  ThemeToggle.tsx           — Sun/Moon toggle; reads/writes localStorage + html.dark class
  Confetti.tsx              — Money emoji rain; accepts messages[] array, cycles with 2s gap
  CategoryTabs.tsx          — Pill tabs for category filtering with counts
  SearchBar.tsx             — Controlled search input
  StatsBar.tsx              — 4 KPI chips computed from realDeals (not mock data)
  ExpiryBadge.tsx           — Color-coded expiry chip (red/amber/green/gray)
  ConfidenceBadge.tsx       — AI confidence indicator (high/medium/low)
  SessionProviderWrapper.tsx — next-auth SessionProvider wrapper required for App Router
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
  sourceEmail: { subject: string; receivedAt: string; senderDomain?: string; messageId?: string }
  status: "active" | "used" | "archived"
  qualityScore: number                // 1-10: 1 base + min(5,floor(effectivePct/10)) + urgent(1) + promoCode(1) + brands(1) + highConfidence(1)
  effectiveDiscountPercent: number    // normalized % for ranking
  notes: string                       // specific product/offer details extracted by Claude
  brands?: string[]
  codeInImage?: boolean
  isRepeatable?: boolean
  repeatFrequency?: string | null
}
```

**Urgency rules:**
- `urgent` — expiry within 48 hours
- `evergreen` — Claude explicitly returns `isEvergreen: true`
- `normal` — everything else (including no-expiry deals not flagged as evergreen)

**effectiveDiscountPercent normalization:**
- `percentage_off` → discountValue
- `dollar_off` → (discountValue / minimumSpend) × 100, capped at 90; fallback 15 if no minimumSpend
- `bogo` → 50
- `freebie` → 100
- `free_shipping` → 10
- `clearance_sale` → 20

---

## Subscription Model (`types/subscription.ts`)

```ts
type SubscriptionFrequency = "monthly" | "annual" | "weekly" | "unknown";
type SubscriptionCategory = "Entertainment" | "Health" | "SaaS" | "Utilities" | "Food" | "Other";
type SubscriptionStatus = "active" | "cancelled" | "unknown";
type SubscriptionConfidence = "high" | "medium" | "low";

interface Subscription {
  id: string
  serviceName: string
  serviceNormalized: string           // lowercase alphanumeric only — dedup key
  amount: number
  currency: string
  frequency: SubscriptionFrequency
  category: SubscriptionCategory
  status: SubscriptionStatus
  lastBilledDate: string | null
  nextBillingDate: string | null      // computed from lastBilledDate + frequency (not by Claude)
  confidenceScore: SubscriptionConfidence
  sourceEmail: { subject: string; receivedAt: string; senderDomain?: string; messageId?: string }
  notes: string
}
```

---

## AI Parsers

### `parseEmailWithClaude(email: RawEmail): Promise<Deal[]>` (`lib/parser.ts`)
1. Builds prompt with subject, body, sender domain, `receivedAt` timestamp.
2. Sends to `claude-sonnet-4-6`, `max_tokens: 2048`.
3. Strips markdown code fences.
4. Maps response → Deal[], computing `dealColor`, `expirationStatus`, `urgency`, `effectiveDiscountPercent` locally.

Key prompt rules: never fabricate; resolve relative dates to absolute ISO using `receivedAt`; include specific product/offer details in `notes`; return `isEvergreen: true` only when email explicitly says "no expiration", "always available", or "ongoing"; return `isRepeatable` and `repeatFrequency` when detectable.

### `parseSubscriptionWithClaude(email: RawEmail): Promise<Subscription[]>` (`lib/subscriptionParser.ts`)
Returns `[]` for non-billing emails and for $0 free trials. Only marks `status: "cancelled"` on explicit cancellation confirmations. `nextBillingDate` computed in code (not by Claude): monthly=+1mo, annual=+1yr, weekly=+7d, unknown=null.

**Inflation filters (layered):**
- Pre-filter: `ONE_TIME_PATTERNS` in email text → return `[]`
- Pre-filter: `.edu` domain or `EDU_KEYWORDS` (`university`, `college`, `school`, `institute`, `enrollment`, `tuition`) in sender domain → return `[]`
- Prompt instruction: use `frequency: "unknown"` unless billing cycle is explicitly stated
- Post-filter: `amount > 2000` → skip; `frequency === "unknown" && amount > 500` → skip; `EDU_KEYWORDS` in serviceName → skip

---

## Gmail Fetcher (`lib/gmailFetcher.ts`)

```ts
// Paginated promo scan — used by streaming sync route
fetchPromoEmailsPage(accessToken, pageToken?, pageSize=25): Promise<{ emails, nextPageToken?, count }>

// Legacy full-fetch (kept for backward compat)
fetchPromoEmails(accessToken: string, maxFetch?: number): Promise<RawEmail[]>

// Bills scan — subject keyword filter, max 1000 emails
const BILLING_QUERY = "subject:(invoice OR receipt OR billing OR subscription OR renewal OR payment OR statement)";
fetchBillingEmails(accessToken: string, maxFetch?: number): Promise<RawEmail[]>
```

All add `messageId` to each email for Gmail deep-link construction. `fetchPromoEmailsPage` applies `PROMO_RE` subject filter before fetching full bodies.

---

## In-Memory Stores

`lib/dealStore.ts` and `lib/subscriptionStore.ts` both use the globalThis singleton pattern:
```ts
const g = globalThis as typeof globalThis & { __dealStore?: Map<string, Deal> };
if (!g.__dealStore) g.__dealStore = new Map();
const store = g.__dealStore;
```
Required because Turbopack hot-reloads modules between requests in dev, resetting module-level `const`.

**Deal dedup key:** `deal.id` (UUID generated per deal per scan — no cross-session dedup yet)
**Subscription dedup key:** `serviceNormalized` — most recent by `lastBilledDate ?? receivedAt`

---

## API Routes

### `POST /api/gmail/sync`
Streams NDJSON via `ReadableStream`. Fetches up to 300 emails in pages of 25, applies keyword pre-filter, runs 5-email Claude batches in groups of 4 parallel. Sends `{ type: "deals", deals, totalFound, scanned }` chunks as they arrive, followed by `{ type: "done", ... }`. No deal count cap — processes all emails up to 300.

### `GET /api/gmail/deals`
Return all deals from dealStore. Returns `{ deals: Deal[], count }`.

### `POST /api/gmail/subscriptions`
Fetch billing emails from Gmail, parse with Claude in batches of 5, store in subscriptionStore. Returns `{ scanned, newSubs, totalStored }`.

### `GET /api/gmail/subscriptions`
Return all subscriptions from subscriptionStore. Returns `{ subscriptions: Subscription[], count }`.

### `GET /api/deals`
Query the mock deal store (kept for `/search` page compat).

| Param | Values | Default |
|---|---|---|
| `view` | `active` \| `top10` \| `stats` | `active` |
| `q` | search string | — |
| `category` | any `Category` value | — |
| `minDiscount` | integer 0–100 | `0` |
| `includeExpired` | `true` \| `false` | `false` |

### `POST /api/parse`
Parse a raw email with Claude (stateless, for testing).
```json
{ "subject": "...", "body": "...", "receivedAt": "ISO 8601", "senderEmail": "...", "senderDomain": "..." }
```
Returns `{ deals: Deal[], count }`. Returns `503` if `ANTHROPIC_API_KEY` missing.

---

## Ranking Logic (`lib/ranker.ts`)

`rankDeals()` sort order:
1. `evergreen` sinks to bottom.
2. `urgent` floats to top.
3. Among same urgency: soonest expiry first.
4. Tie-break: highest `qualityScore`.

Top 10 Steals (in `page.tsx`) sorted by `qualityScore` descending.

`searchDeals()` matches against: retailer, retailerNormalized, category, promoCode, notes, brands, offerType.

---

## Dashboard Layout (`app/page.tsx`)

**Desktop (lg+):** sticky header → two-column flex:
- Left: 300/320px sticky `SubscriptionSidebar`
- Right: `StatsBar` → Expiring Soon (collapsible) → `TopSteals` → Deals Feed → Evergreen Shelf

**Mobile:** sticky header → tab content → fixed bottom nav (Deals | Bills tabs)

Stats (totalActive, expiringToday, categoriesCount, estimatedSavings) computed inline from `realDeals` via `useMemo`. Not from mock getDashboardStats.

Confetti fires after both scans complete with two sequential messages: deals found, then subscriptions/monthly total.

---

## Dark Mode

CSS custom properties on `:root` (light) and `.dark` (dark):
```css
/* in globals.css */
@custom-variant dark (&:where(.dark, .dark *));
:root { --bg: #F2F2F7; --card: #FFFFFF; --surface: #F2F2F7; --text-1: #1C1C1E; ... }
.dark  { --bg: #000000; --card: #1C1C1E; --surface: #2C2C2E; --text-1: #FFFFFF; ... }
```

No-FOUC: inline `<script>` in `<head>` reads `localStorage.getItem('theme')` and adds `.dark` to `<html>` before first paint. `suppressHydrationWarning` on `<html>`. `ThemeToggle` reads initial state from `document.documentElement.classList`.

---

## Auth (`lib/auth.ts`, `next-auth` v5 beta)

```ts
// next-auth v5 config pattern
export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [Google({ authorization: { params: { scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly" } } })],
  callbacks: {
    jwt({ token, account }) { if (account?.access_token) token.accessToken = account.access_token; return token; },
    session({ session, token }) { session.accessToken = token.accessToken; return session; },
  },
});
```

`session.accessToken` flows to all `/api/gmail/*` routes via `auth()`.

---

## Guardrails

- **Read-only** — the app never modifies, replies to, labels, or deletes any email.
- **No auto-apply** — promo codes displayed for manual use only.
- **No fabrication** — parser prompts explicitly prohibit inventing deals or subscriptions.
- **Confidence signaling** — every deal and subscription carries a `confidenceScore`.
- **API key safety** — never paste API keys into Claude Code chat or any AI chat. Set via terminal only (`echo "KEY=val" >> .env.local`).
- **Two separate local projects** — mykind and dealdetective. Never mix.

---

## What's Built vs. What's Next

### Done
- Full Deal + Subscription type systems.
- Claude-powered parsers for both deal emails and billing emails.
- Real Gmail streaming ingestion — promo scan streams NDJSON, deals appear in the feed as they parse. Up to 300 emails, 4 parallel Claude batches of 5.
- Two-panel dashboard with full dark mode, confetti, live scan counter.
- Subscriptions sidebar: Rocket Money-style recurring charge tracker with clickable deduplicated billing alerts.
- Copy code button on every promo code pill.
- Quality score badge (1-10) on each deal card; deals sorted by quality score.
- Subscription inflation filters: EDU domain/name detection, $2000 hard cap, unknown-frequency large-charge filter.
- Mobile-responsive with bottom tab bar.
- Search page with full filter set.
- GmailConnect is a stateless display component; all scan state lives in page.tsx.
- REST API ready for a future real data layer.

### Not yet built
- Persistent storage (database) — currently resets on server restart.
- "Mark as used" deal status management UI.
- Cross-session deal deduplication.
- Push notifications for expiring deals.
- User authentication beyond single-user OAuth.
- Email ingestion pipeline (webhooks/polling vs. manual scan).
- Google app verification for public users.
- Production deployment (Vercel).

---

## Local Dev

```bash
cp .env.example .env.local   # add all 5 env vars (no leading spaces)
npm install
npm run dev                  # http://localhost:3001
```

Test the parser:
```bash
curl -X POST http://localhost:3001/api/parse \
  -H "Content-Type: application/json" \
  -d '{"body":"40% off sitewide, use code SAVE40. Expires June 30.","receivedAt":"2026-06-26T10:00:00Z","senderDomain":"example.com"}'
```
