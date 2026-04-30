# BoosterIQ V1 — Build Brief

## What we're building

BoosterIQ is an intelligence layer for youth-sports booster club concession operations. It does not replace the tools clubs already use (Square, Google Drive, SignUp Genius). It aggregates them and produces one weekly decision: what to buy before the next game, and which volunteer slots still need fills.

The primary user is a volunteer concessions chair — typically a parent with a full-time job, no IT support, and limited patience for software that requires configuration. The product must feel like a helper, not a tool.

The pilot club is the Lago Vista Vikings Booster (Texas). V1 is single-tenant for them; multi-tenant is V2.

## The core loop V1 must implement

1. Receipt photo uploaded → parsed by Claude API → matched to catalog → updates inventory stock counts and cost basis
2. Square sales CSV uploaded after a game → matched to catalog → depletes inventory based on what was sold
3. SignUp Genius public roster URL scraped on schedule → produces volunteer slot-fill data per event
4. Dashboard surfaces: post-game metrics, auto-generated shopping list before next game, volunteer coverage status

## Stack and deployment

- Next.js 15 (App Router) on Vercel — see DECISIONS.md D10 for why we updated from the originally-spec'd 14
- Supabase for Postgres database (auth deferred — V1 ships public; revisit before pilot launch)
- Google Drive for file storage (receipt photos, Square CSVs, Master Sheet) — single source of truth, leverages existing booster Drive folder
- Anthropic API (claude-sonnet-4-6) for all parsing and matching logic; non-streaming with structured outputs via tool use, prompt caching on system prompt + catalog context
- Google Drive API for Master Sheet read/write and folder management
- Square OAuth for sales data, with manual CSV upload as fallback
- Tailwind CSS for styling
- TypeScript throughout
- No app authentication in V1 — pilot deployment is publicly accessible (see DECISIONS.md D4 + D7)
- No SMS in V1 — Twilio integration deferred (see DECISIONS.md D8)

Single repository, monorepo not needed. Serverless functions for parsing operations to keep costs predictable.

## Data model (the load-bearing decision)

Two core tables, plus event/transaction tables.

`catalog_items` — one row per thing the club stocks. Source of truth for inventory state. Fields: id, club_id, name, unit, par_level, current_stock, cost_basis_cents, vendor, created_at, updated_at.

`menu_items` — one row per thing Square sells. Maps Square SKU to catalog item(s). V1 is 1:1 SKU mapping only (no recipes). Fields: id, club_id, square_item_name, price_cents, catalog_item_id (foreign key), created_at.

`events` — one row per game. Fields: id, club_id, name, opponent, date, attendance_actual, attendance_predicted, weather, signupgenius_url, created_at.

`receipts` — one row per supply run. Fields: id, club_id, vendor, receipt_date, total_cents, photo_url, parsed_data_json, processed_at, created_at.

`square_imports` — one row per Square CSV upload. Fields: id, club_id, event_id, csv_url, parsed_data_json, processed_at, created_at.

`stock_movements` — append-only ledger of every change to current_stock. Fields: id, catalog_item_id, delta, source_type ('receipt' | 'sale' | 'manual'), source_id, occurred_at. Never update current_stock directly; always insert a movement and recompute. This is the audit trail.

`volunteer_slots` — scraped from SignUp Genius. Fields: id, event_id, role, slot_position, filled_by_name, filled_at, scraped_at.

`volunteer_contacts` — phone numbers and opt-in status. Fields: id, club_id, name, phone, opted_in_at, opted_out_at, created_at.

## What V1 includes

- Conversational onboarding wizard (6 steps in V1): club name → Drive OAuth → Master Sheet seed → Square OAuth or CSV fallback → SignUp Genius URL → first event setup (Twilio verification step deferred)
- Master Inventory Sheet stored in Drive, version-controlled in /Archive/
- Receipt photo upload with Claude API parsing
- Square CSV upload with auto-depletion math
- SignUp Genius scraper running on cron (daily) plus manual refresh button
- Dashboard with: latest event recap, three core metrics, shopping list with urgency tiers, volunteer coverage panel, six quick actions
- Printable PDF post-game report
- Two-page UI (dashboard + settings); no router complexity beyond that

## What V1 explicitly does NOT include

- Recipe layer (multi-ingredient menu items) — V2
- Predictive forecasting based on weather/opponent — V2
- Cash variance tracking — V2
- Margin intelligence with cost-erosion alerts — V2
- Multi-tenant board roles — V2
- Barcode scanning — V2
- Multi-event analytics or trend lines — V2
- Stripe billing — post-pilot
- Email automation — post-pilot
- SMS reminders via Twilio — deferred (was in original brief, dropped 2026-04-30 per DECISIONS.md D8)
- App-level authentication — deferred (DECISIONS.md D4)
- Edge basic-auth deployment shield — deferred (DECISIONS.md D7)

If a feature is not in the V1 list, do not build it. Ask before adding.

## Brand and visual design

Vikings color palette:
- Royal blue #1F4D9E (primary actions, header)
- Deep navy #0F2C66 (text, dark accents)
- Gold #F5C518 (highlights, CTAs)
- Cream #FFF8E1 (light-mode warm surfaces)

Dark mode by default with light mode toggle. Dark mode neutral palette: background #0F0F12, cards #1A1A20, subtle borders rgba(255,255,255,0.08).

Typography: -apple-system stack, no custom fonts in V1. Keep type scale modest — 11px to 22px range covers everything in the dashboard.

UI patterns to match across all panels:
- Card with subtle border, rounded corners (12px)
- Top bar with title + auto-sync indicator showing data source
- Body content with consistent 16-20px padding
- Primary action button at panel bottom, full-width
- Urgency tiers use Critical (orange-red), Low (gold), Filled (green) tags

## Receipt parsing — Claude API call structure

System prompt for receipt parsing should:
- Identify vendor, date, and total
- Extract line items as {description, quantity, unit_price_cents, total_cents}
- Flag uncertain reads with confidence score
- Reconcile line items sum vs receipt total (flag discrepancies)
- Return structured JSON, no prose

Match parsed line items to catalog by:
1. Exact name match (high confidence, auto-apply)
2. Fuzzy match against existing item history (medium confidence, confirm)
3. New item (low confidence, prompt to add to catalog)

Cost-change detection: if a matched item's parsed unit_price differs from its catalog cost_basis by >5%, flag for user confirmation before updating.

## Square CSV ingestion

Square's Item Sales export contains columns including: Date, Time, Category, Item, Qty, Price Point Name, SKU, Modifiers Applied, Gross Sales, Discounts, Net Sales, Tax, Transaction ID, Payment ID. V1 only needs Date, Item, Qty, Net Sales for each row.

For each Square Item that doesn't have a menu_items row yet, prompt user to create the mapping. Once mapped, depletion is automatic.

## SignUp Genius scraping

The public sign-up URL renders HTML server-side. Use a fetch + cheerio (or similar) parser. Extract the role headers and the participant names/slots underneath each. Map roles to a per-club configuration of which roles count as "Critical" vs "Low" priority for staffing.

Build the scraper defensively: log raw HTML on parse failure, fail gracefully with a "couldn't sync — last known data shown" UX, not a crash.

**Manual-paste fallback (ships in V1, not deferred).** Provide a second ingestion path: a textarea where the chair can paste the visible roster from SignUp Genius, parsed by Claude API into the same `volunteer_slots` shape. This is the durable path if SignUp Genius changes their HTML or blocks scraping. The scraper is the convenience; the paste fallback is the guarantee.

## Build sequence (do in this order)

1. Project scaffold: Next.js + Supabase + Tailwind (no auth in V1)
2. Database schema: all tables above with migrations
3. Master Sheet upload + Claude API parsing into catalog_items
4. Receipt photo upload + Claude API parsing + catalog matching
5. Square CSV upload + sales depletion math
6. Dashboard read-only with seeded data
7. SignUp Genius scraper + manual-paste fallback + volunteer_slots ingestion
8. Volunteer panel on dashboard
9. Conversational onboarding wizard (no SMS verification step in V1)
10. PDF report generator
11. Polish, error states, edge case handling

Build each step end-to-end before moving to the next. Don't stub features across multiple steps; ship one working slice at a time.

## How to work

Ask clarifying questions before making architectural decisions you're uncertain about. Specifically:
- Database choice if you have a strong preference other than Supabase
- File storage approach (Supabase Storage vs S3 vs Drive itself)
- Authentication pattern (magic link, password, OAuth-only)
- How to structure the Anthropic API calls (streaming vs not, structured outputs via JSON mode, etc.)

For everything else, make sensible defaults and document them in a DECISIONS.md file at the repo root so I can review.

Keep code idiomatic. Prefer simple over clever. Comments only where non-obvious. TypeScript strict mode on. ESLint and Prettier configured.

Write tests for the parsing logic specifically — receipt parsing, Square CSV parsing, and SignUp Genius scraping all have edge cases that benefit from test coverage. Skip tests for UI components in V1.

## Sample data

I'll provide:
- 5 sample receipts (Sam's Club, Costco, HEB, two generic) as JPG/PDF
- 3 sample Square CSV exports from past games
- The Vikings Booster's existing inventory list as CSV
- One real SignUp Genius URL from a recent Vikings game

Use these as fixtures for development. Real production data comes from the booster's actual accounts via OAuth once those are set up.

## Definition of done for V1

- The Vikings concessions chair can complete onboarding in <10 minutes
- After a game, she can upload Square CSV and get a shopping list in <2 minutes
- Receipt scanning works on Sam's Club and HEB receipts with >90% accuracy
- Volunteer dashboard shows accurate slot-fill data within 4 hours of a SignUp Genius update
- The whole thing runs for $30/month or less in infrastructure (excluding Anthropic API costs)
- One real game from start to finish: setup completed Monday, supply run receipt scanned Wednesday, Square uploaded post-game Saturday, report printed for Tuesday's board meeting

Start with question 1: any architectural decisions above you'd push back on before we begin?
