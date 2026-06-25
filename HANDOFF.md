# DealDetective — Full Project Handoff Document
**Last updated: June 25, 2026**
**Repo: https://github.com/JoeyValentine/dealdetective**
**Built by: Giuseppe (Joey Valentine) + Claude**

---

## ⚠️ SESSION HANDOFF NOTE
This document was created mid-build when Claude hit its usage limit. The next Claude session or agent should:
1. Read this entire document first
2. Read `CLAUDE.md` in the repo root
3. Pick up at **"What Needs To Be Built Next"** — specifically Gmail OAuth which is 90% configured
4. Never ask Giuseppe to re-explain what's already been built
5. Check yourself before every instruction: is this safe, efficient, smart, good for the foundation?

---

---

## What This Is

DealDetective is an AI-powered promotional email analyzer. It connects to a user's email inbox, reads promotional emails in read-only mode, extracts deals using Claude AI, and displays everything on a clean dashboard — ranked by urgency and discount quality, with search and filtering.

Think: Apple Wallet meets a deals dashboard. iOS-style UI, dark navy + amber palette.

---

## Current Status (What's Done)

### ✅ Fully Built & Working
- Full Next.js 15 app with TypeScript + Tailwind CSS
- iOS-style dashboard UI with:
  - Stats bar (active deals, expiring today, categories, estimated savings)
  - Expiring Soon section (red-flagged, collapsible, deals within 48h)
  - Top 10 Steals (ranked by highest effective discount %)
  - Deals Feed (filterable by category, min discount %)
  - Search page (brand + retailers carrying that brand)
  - Always Available shelf (evergreen/no-expiry codes)
- Claude AI parser (`/api/parse`) — tested and working
  - Extracts: retailer, offer type, discount value, promo code, expiry, category, confidence score
  - Handles: relative dates, multiple offers per email, code fence stripping bug fixed
- 30 mock deals across all categories (realistic data)
- REST API (`/api/deals`) with full query/filter support
- Ponytail installed (code efficiency plugin)
- CLAUDE.md written (full project context file in repo root)
- Pushed to GitHub: https://github.com/JoeyValentine/dealdetective

### 🔄 In Progress Right Now
- Gmail OAuth setup via Google Cloud Console
  - Project created: `dealdetective-500518`
  - Gmail API enabled ✅
  - OAuth consent screen configured ✅
  - Scope added: `https://www.googleapis.com/auth/gmail.readonly` ✅
  - Currently on Step 4: Creating OAuth Client ID (Web application)
  - Redirect URI will be: `http://localhost:3001/api/auth/callback/google`
  - Once Client ID + Secret are created → add to `.env.local` (NOT Claude Code chat)

### ❌ Not Yet Built
- Gmail OAuth flow in the Next.js app (NextAuth.js integration)
- Real email ingestion pipeline (fetch emails → parse → display)
- Persistent storage / database
- "Mark as used" UI
- Push notifications for expiring deals
- Microsoft Graph API for Outlook/Strada support
- Multi-user support
- Production deployment (Vercel)
- Google app verification (needed for public users, not needed for internal/testing)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| AI | Anthropic SDK → `claude-sonnet-4-6` |
| Auth (planned) | NextAuth.js with Google provider |
| Icons | lucide-react |
| Runtime | Node.js |
| Repo | GitHub (JoeyValentine/dealdetective) |

---

## File Structure

```
dealradar/                        ← local folder name
├── app/
│   ├── page.tsx                  ← Main dashboard
│   ├── layout.tsx
│   ├── search/page.tsx           ← Search page
│   └── api/
│       ├── deals/route.ts        ← GET /api/deals
│       └── parse/route.ts        ← POST /api/parse
├── components/
│   ├── DealCard.tsx
│   ├── TopSteals.tsx
│   ├── CategoryTabs.tsx
│   ├── SearchBar.tsx
│   ├── StatsBar.tsx
│   ├── ExpiryBadge.tsx
│   └── ConfidenceBadge.tsx
├── lib/
│   ├── parser.ts                 ← Claude AI email parser
│   ├── ranker.ts                 ← Deal ranking algorithm
│   └── mockData.ts               ← 30 seeded deals
├── types/
│   └── deal.ts                   ← All TypeScript types
├── CLAUDE.md                     ← Full technical context (read this first)
├── .env.example                  ← Template for env vars
└── .env.local                    ← NEVER commit this (gitignored)
```

---

## Environment Variables

```bash
# .env.local (never commit this file)
ANTHROPIC_API_KEY=sk-ant-...          # Get from console.anthropic.com
GOOGLE_CLIENT_ID=...                  # From Google Cloud Console
GOOGLE_CLIENT_SECRET=...             # From Google Cloud Console
NEXTAUTH_SECRET=...                   # Run: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3001
```

---

## Core Data Model

```typescript
interface Deal {
  id: string
  retailer: string                    // "Sephora"
  retailerNormalized: string          // "sephora"
  category: Category                  // 10 categories
  offerType: OfferType                // percentage_off | dollar_off | bogo | free_shipping | freebie | clearance_sale
  dealColor: DealColor                // blue | purple | green | orange | teal | yellow
  discountValue: number
  discountUnit: "percent" | "dollars" | "bogo" | "free"
  promoCode: string | null
  minimumSpend: number | null
  restrictions: string | null
  expirationDate: string | null       // ISO 8601
  expirationStatus: "active" | "expiring_soon" | "expired" | "no_expiry"
  urgency: "normal" | "urgent" | "evergreen"
  confidenceScore: "high" | "medium" | "low"
  effectiveDiscountPercent: number    // normalized % for ranking
  status: "active" | "used" | "archived"
  qualityScore: number                // 0-100
}
```

---

## Deal Color System
| Deal Type | Color |
|---|---|
| % off standard | Blue |
| 50%+ / half off | Purple |
| BOGO | Green |
| $ off | Orange |
| Free shipping / freebie | Teal |
| Clearance / sale event | Yellow |
| Expiring ≤48h | Red urgency flag (overlaid) |

---

## Ranking Logic
1. Urgent deals (expiring ≤48h) float to top
2. Evergreen deals sink to bottom shelf
3. Among same urgency: soonest expiry first
4. Tie-break: highest effectiveDiscountPercent

---

## Guardrails (Non-Negotiable)
- **Read-only** — NEVER modify, label, delete, or move emails
- **No auto-apply** — promo codes displayed for manual use only
- **No fabrication** — parser prompt explicitly prohibits inventing deals
- **Confidence scoring** — every deal shows high/medium/low confidence
- **No dark patterns** — no fake urgency, no manufactured scarcity
- **Minimal data** — extract only: retailer, offer type, discount, code, category, expiry. Discard everything else.

---

## What Needs To Be Built Next (Priority Order)

### 1. Complete Gmail OAuth (credentials ready — build the flow)

**Google Cloud is fully configured:**
- Project: `dealdetective-500518`
- Gmail API: enabled
- OAuth Client ID: created (Web application type)
- Scope: `https://www.googleapis.com/auth/gmail.readonly`
- Redirect URI: `http://localhost:3001/api/auth/callback/google`
- JSON credentials file: downloaded (Giuseppe has it)

**All 4 env vars should already be in `~/dealradar/.env.local`:**
```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=...   # generated with: openssl rand -base64 32
```

**If not set yet, run these in Mac terminal (NOT Claude Code):**
```bash
echo "GOOGLE_CLIENT_ID=your_id" >> ~/dealradar/.env.local
echo "GOOGLE_CLIENT_SECRET=your_secret" >> ~/dealradar/.env.local
echo "NEXTAUTH_URL=http://localhost:3001" >> ~/dealradar/.env.local
openssl rand -base64 32   # copy output, then:
echo "NEXTAUTH_SECRET=paste_output" >> ~/dealradar/.env.local
```

**Now tell Claude Code to build the OAuth flow with this exact prompt:**
```
Install NextAuth.js and build the full Gmail OAuth flow. 
Read CLAUDE.md first for full context. Then:
1. Install: npm install next-auth @auth/core
2. Create app/api/auth/[...nextauth]/route.ts with Google provider
3. Request scope: https://www.googleapis.com/auth/gmail.readonly
4. Add a "Connect Gmail" button to the dashboard
5. After auth, fetch the last 500 emails from Gmail Promotions tab only
6. Pass each email to /api/parse and add results to the deal store
7. Show a loading state while emails are being scanned
8. Read-only only — no modify, delete, or label permissions ever
All credentials are in .env.local already.
```

**Add Brad as a test user:**
- Go to console.cloud.google.com → DealDetective project
- APIs & Services → OAuth consent screen → Test users
- Add Brad's Gmail address
- He can now log in and authorize the app

### 2. Email Ingestion Pipeline
- After OAuth, fetch emails from Gmail API
- Filter to Promotions tab / promotional senders only
- Pass each email body to `/api/parse`
- Merge parsed deals with existing deal store
- Handle deduplication (same merchant + code + value = keep freshest)

### 3. Persistent Storage
- Currently all mock data, resets on server restart
- Add SQLite (simple) or Postgres (scalable)
- Store parsed deals persistently
- Track deal status (active/used/archived)

### 4. "Mark as Used" UI
- Button on each deal card
- Updates status to "used", removes from active feed
- Keeps in archive

### 5. Outlook/Strada Support
- Microsoft Graph API (same concept as Gmail OAuth)
- Brad's actual email is Strada (Outlook-based custom domain)
- Requires Azure app registration (same process as Google Cloud)

### 6. Production Deployment
- Deploy to Vercel (free tier works)
- Update redirect URIs in Google Cloud Console
- Add production env vars to Vercel dashboard

---

## How To Run Locally

```bash
git clone https://github.com/JoeyValentine/dealdetective.git
cd dealdetective
npm install
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
npm run dev
# Open http://localhost:3001
```

---

## Test the Parser

```bash
curl -X POST http://localhost:3001/api/parse \
  -H "Content-Type: application/json" \
  -d '{
    "body": "40% off sitewide, use code SAVE40. Expires June 30.",
    "receivedAt": "2026-06-25T10:00:00Z",
    "senderDomain": "example.com"
  }'
```

---

## Key Decisions Made

- **Gmail API over Gmail MCP API** — MCP API is too new/undocumented for a Next.js OAuth flow. Gmail MCP can be layered on later for OpenClaw agent integration.
- **Mock data first** — Full UI works immediately without real email connection. Swap in real data later.
- **Read-only scope only** — `gmail.readonly` is the most restrictive Gmail scope. Matches guardrails spec exactly.
- **Testing mode OAuth** — Not a public app. Add test users manually in Google Cloud Console. Brad gets added as a test user.
- **No database yet** — MVP runs stateless. Add SQLite/Postgres in next phase.
- **Ponytail installed** — Code efficiency plugin active. Run `/ponytail-review` after major builds to trim bloat.

---

## Important Notes for Next Agent/Developer

1. **Read CLAUDE.md in the repo root first** — most detailed technical context lives there
2. **Never commit .env.local** — it's gitignored, keep all secrets there
3. **API key safety** — never paste API keys into Claude Code chat or any AI chat. Always set via terminal directly.
4. **The app runs on port 3001** not 3000 (3000 was taken by mykind project)
5. **Ponytail is active** — it'll push back on over-engineering, that's intentional
6. **Two separate projects on this machine** — mykind (separate MVP) and dealdetective. Don't mix them.
7. **GitHub token was exposed earlier** — already rotated, new token in use
8. **Anthropic API key was exposed earlier** — already rotated, new key in .env.local

---

## Reference Documents (ask Giuseppe for these)
- `Coupon_Concierge_Overview.pdf` — intern pitch doc with category taxonomy and color system
- `Coupon_Agent.pdf` — guardrails and design conditions (AAA Global Consulting)
- `Email_Deal_Agent_Project_Spec.md` — original project spec
- `DealDetective_Master_Prompt.md` — master Claude Code build prompt

---

## Contact
- **Giuseppe (Joey Valentine)** — builder
- **GitHub:** JoeyValentine
- **Project email:** giuseppepata23@gmail.com
