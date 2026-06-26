# DealDetective — Handoff Document
**Last updated: June 26, 2026**
**Repo: https://github.com/JoeyValentine/dealdetective**
**Built by: Giuseppe (Joey Valentine) + Claude**

---

## What This Is

DealDetective is an AI-powered promotional email analyzer and subscription tracker. It connects to Gmail in read-only mode, scans promotional emails for deals and billing emails for subscriptions, and presents everything on a two-panel dashboard — deals feed on the right, subscriptions sidebar on the left.

---

## Current Status

### Done
- Full Next.js 16.2.9 App Router app with TypeScript + Tailwind CSS v4
- Google OAuth via next-auth v5 (beta) with `gmail.readonly` scope
- Real Gmail scanning: promotions tab (up to 500 emails for deals, up to 1000 for billing)
- Claude AI deal parser (`lib/parser.ts`) — extracts retailer, offer, promo code, expiry, category, notes, Gmail messageId
- Claude AI subscription parser (`lib/subscriptionParser.ts`) — extracts service name, amount, frequency, next billing date, category, cancellation status
- In-memory deal store and subscription store — both use globalThis singleton pattern to survive Turbopack module reloads in dev
- Dashboard: stats bar, expiring-soon shelf, Top 10 Steals horizontal strip, filterable deal feed, evergreen shelf
- Subscriptions & Bills sidebar: hero monthly total, category breakdown, Upcoming This Week, Active Subscriptions, Recently Cancelled, privacy footer
- Desktop two-column layout (300px sticky sidebar + flex-1 main); mobile bottom tab bar (Deals | Bills)
- Dark mode with no-FOUC (CSS custom properties, Tailwind v4 `@custom-variant dark`, inline `<script>` in `<head>`, ThemeToggle component, localStorage persistence)
- Confetti animation on scan complete: money/bill emojis, two sequential celebration messages
- Scan progress: elapsed timer + indeterminate scanning bar + estimated time copy
- Repeatable deal badges (violet RefreshCw badge when `isRepeatable: true`)
- Gmail links on every deal card and subscription item
- Search page (`/search`) with full filter set (category, min discount, include expired)
- Mock data cleared — app runs entirely on real Gmail data

### Not Yet Built
- Persistent storage (database) — everything resets on server restart
- "Mark as used" UI for deals
- Push notifications for expiring deals
- Deal deduplication across sessions (currently deduped within a single scan)
- Google app verification for public users (currently requires manually adding test users in GCP console)
- Production deployment to Vercel
- Outlook / Microsoft Graph API support

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
| Runtime | Node.js / Vercel edge-compatible |

---

## File Structure

```
app/
  page.tsx                         — Main dashboard (two-column desktop, mobile tabs)
  layout.tsx                       — Root layout with no-FOUC dark mode script
  search/page.tsx                  — Full-featured search page
  api/
    deals/route.ts                 — GET /api/deals — query mock store (kept for compat)
    parse/route.ts                 — POST /api/parse — parse a raw email with Claude
    gmail/
      sync/route.ts                — POST: fetch + parse promo emails; GET: return stored deals
      deals/route.ts               — GET /api/gmail/deals — return dealStore contents
      subscriptions/route.ts       — POST: fetch + parse billing emails; GET: return stored subs

lib/
  auth.ts                          — next-auth config: Google provider, gmail.readonly scope, accessToken in JWT
  parser.ts                        — parseEmailWithClaude() + computeEffectivePercent()
  subscriptionParser.ts            — parseSubscriptionWithClaude() + computeNextBillingDate()
  gmailFetcher.ts                  — fetchPromoEmails() (category:promotions) + fetchBillingEmails() (subject keywords)
  dealStore.ts                     — globalThis singleton Map<string, Deal>
  subscriptionStore.ts             — globalThis singleton Map<string, Subscription>
  ranker.ts                        — rankDeals(), searchDeals(), getExpiryCountdown()
  mockData.ts                      — empty mockDeals array; helper fns kept for /api/deals compat

types/
  deal.ts                          — Deal, Category, OfferType, DealColor, RawEmail, etc.
  subscription.ts                  — Subscription, SubscriptionFrequency, SubscriptionCategory, etc.

components/
  DealCard.tsx                     — Single deal card (compact + full); gradient bg; repeat badge; Gmail link
  TopSteals.tsx                    — Horizontal top-10 strip with notes, Gmail links, gradient backgrounds
  SubscriptionSidebar.tsx          — Full subscription panel (hero stat, analytics, upcoming, active, cancelled)
  GmailConnect.tsx                 — OAuth sign-in button + parallel scan trigger + elapsed timer
  ThemeToggle.tsx                  — Sun/Moon toggle; reads/writes localStorage + html.dark class
  Confetti.tsx                     — Money emoji rain; cycles through messages[] then dismisses
  CategoryTabs.tsx                 — Category filter pills with counts
  SearchBar.tsx                    — Controlled search input
  StatsBar.tsx                     — 4 KPI chips (computed from realDeals, not mock data)
  ExpiryBadge.tsx                  — Color-coded expiry chip
  ConfidenceBadge.tsx              — AI confidence indicator
  SessionProviderWrapper.tsx       — next-auth SessionProvider wrapper (required for App Router)
```

---

## Environment Variables

```bash
# .env.local (NEVER commit this file)
ANTHROPIC_API_KEY=sk-ant-...          # Get from console.anthropic.com — no leading space
GOOGLE_CLIENT_ID=...                  # From Google Cloud Console — project: dealdetective-500518
GOOGLE_CLIENT_SECRET=...              # From Google Cloud Console
NEXTAUTH_SECRET=...                   # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3001    # match whatever port the dev server runs on
```

---

## Core Data Models

### Deal (`types/deal.ts`)
```ts
interface Deal {
  id: string
  retailer: string
  retailerNormalized: string
  category: Category
  offerType: OfferType
  dealColor: DealColor
  discountValue: number
  discountUnit: "percent" | "dollars" | "bogo" | "free"
  promoCode: string | null
  minimumSpend: number | null
  restrictions: string | null
  expirationDate: string | null         // ISO 8601
  expirationStatus: "active" | "expiring_soon" | "expired" | "no_expiry"
  urgency: "normal" | "urgent" | "evergreen"
  confidenceScore: "high" | "medium" | "low"
  sourceEmail: { subject: string; receivedAt: string; senderDomain?: string; messageId?: string }
  status: "active" | "used" | "archived"
  qualityScore: number
  effectiveDiscountPercent: number
  notes: string
  brands?: string[]
  codeInImage?: boolean
  isRepeatable?: boolean
  repeatFrequency?: string | null
}
```

### Subscription (`types/subscription.ts`)
```ts
interface Subscription {
  id: string
  serviceName: string
  serviceNormalized: string             // lowercase alphanumeric only — dedup key
  amount: number
  currency: string
  frequency: SubscriptionFrequency      // "monthly" | "annual" | "weekly" | "unknown"
  category: SubscriptionCategory        // "Entertainment" | "Health" | "SaaS" | "Utilities" | "Food" | "Other"
  status: SubscriptionStatus            // "active" | "cancelled" | "unknown"
  lastBilledDate: string | null
  nextBillingDate: string | null        // computed from lastBilledDate + frequency
  confidenceScore: SubscriptionConfidence
  sourceEmail: { subject: string; receivedAt: string; senderDomain?: string; messageId?: string }
  notes: string
}
```

---

## Key Architecture Decisions

### globalThis singleton stores
Turbopack hot-reloads modules between requests in dev. A plain `const store = new Map()` at module scope resets every request. `globalThis.__dealStore` / `globalThis.__subscriptionStore` survives reloads.

### Urgency defaults
No-expiry deals default to `urgency: "normal"` unless Claude explicitly returns `isEvergreen: true`. Critical bug fix — defaulting to `"evergreen"` caused 53+ deals to be stored but only 2 rendered (the filteredDeals memo excludes evergreen from the main feed).

### effectiveDiscountPercent normalization
| Offer type | Computation |
|---|---|
| percentage_off | discountValue |
| dollar_off | (discountValue / minimumSpend) × 100, capped at 90; fallback 15 |
| bogo | 50 |
| freebie | 100 |
| free_shipping | 10 |
| clearance_sale | 20 |

### Dark mode
CSS custom properties on `:root` and `.dark`. Tailwind v4 uses `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css` (no tailwind.config.js). No-FOUC: inline `<script>` in `<head>` reads localStorage and applies `.dark` before first paint. `suppressHydrationWarning` on `<html>`.

### Parallel scanning
GmailConnect fires POST `/api/gmail/sync` (deals) and POST `/api/gmail/subscriptions` (bills) simultaneously via `Promise.allSettled`. Then fetches both result sets in parallel. UI waits for both before calling callbacks and firing confetti.

### Subscription dedup
Key: `serviceNormalized` (lowercase, non-alphanumeric stripped). Most recent record wins using `lastBilledDate ?? sourceEmail.receivedAt`.

---

## Guardrails (Non-Negotiable)

- **Read-only** — NEVER modify, label, delete, or move any email. `gmail.readonly` scope only.
- **No auto-apply** — promo codes displayed for manual use only.
- **No fabrication** — parser prompts explicitly prohibit inventing deals or subscriptions.
- **API key safety** — never paste API keys into Claude Code chat or any AI chat. Set via terminal only.
- **Two separate projects on this machine** — mykind (separate MVP) and dealdetective. Don't mix them.

---

## Local Dev

```bash
git clone https://github.com/JoeyValentine/dealdetective.git
cd dealdetective
npm install
# Set all env vars in .env.local (see above)
npm run dev
# Open http://localhost:3001 (or 3000)
```

Test the deal parser:
```bash
curl -X POST http://localhost:3001/api/parse \
  -H "Content-Type: application/json" \
  -d '{"body":"40% off sitewide, use code SAVE40. Expires June 30.","receivedAt":"2026-06-26T10:00:00Z","senderDomain":"example.com"}'
```

---

## What to Build Next (Priority Order)

1. **Persistent storage** — SQLite or Postgres to survive server restarts. Currently everything resets.
2. **"Mark as used" UI** — Button on each deal card → sets `status: "used"`, removes from active feed.
3. **Deal deduplication across sessions** — Cross-session dedup by `retailerNormalized + promoCode + discountValue`.
4. **Push notifications** — Alert when deals expire within 12h (requires persistent storage first).
5. **Google app verification** — Currently test-mode OAuth; users added manually in GCP console.
6. **Vercel deployment** — Update redirect URIs in GCP; add env vars to Vercel dashboard.

---

## Google Cloud Project

- **Project:** `dealdetective-500518`
- **Gmail API:** enabled
- **OAuth consent screen:** configured (test mode)
- **Scope:** `https://www.googleapis.com/auth/gmail.readonly`
- **Redirect URI:** `http://localhost:3001/api/auth/callback/google`

To add a test user: GCP Console → DealDetective → APIs & Services → OAuth consent screen → Test users → Add email.
