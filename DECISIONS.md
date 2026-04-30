# Architectural Decisions

This file logs architectural decisions made during the BoosterIQ V1 build. Each entry records the decision, the alternatives considered, and the rationale.

---

## 2026-04-30 — Pre-build foundation

### D1. Project name: BoosterIQ
The brief was titled "ConcessionIQ V1" but the canonical product name is **BoosterIQ**. The brief has been updated to match. ConcessionIQ is not used anywhere going forward.

### D2. Claude model: `claude-sonnet-4-6`
The brief specified `claude-sonnet-4-20250514`, which doesn't match current Anthropic model IDs. Going with the latest Sonnet, which is the right tier for receipt parsing, CSV matching, and SignUp Genius parsing — Opus is overkill for these tasks and would burn the $30/month infra budget faster than needed. We can revisit per-task model selection if any specific call needs more reasoning headroom.

### D3. File storage: Google Drive (not Supabase Storage)
**Decision:** Receipt photos, Square CSVs, and the Master Inventory Sheet all live in the booster's existing Google Drive folder. Database rows store the Drive file ID + URL, not bytes.

**Rationale:**
- The booster already has a Drive folder (`~/Documents/Booster`) full of receipts, sponsor PDFs, and inventory spreadsheets. Putting BoosterIQ's files alongside that material keeps everything in one place the chair already knows.
- Drive ownership stays with the club, not us. If the pilot ends or we hand off, nothing is locked behind our infra.
- Drive's preview/sharing UX is something we don't have to rebuild.

**Tradeoffs accepted:**
- Drive API quotas + OAuth token refresh become a hard dependency on the upload path. We'll need defensive handling.
- Latency for image fetches (Claude API parsing) will be higher than Supabase Storage. Acceptable for non-realtime parsing flows.
- Drive doesn't give us signed URLs as cleanly — we'll proxy file access through our own routes.

**Alternatives considered:** Supabase Storage (faster, simpler signed URLs, but creates a second source of truth for files); S3 (most flexibility, but adds a vendor and cost line for no clear V1 benefit).

### D4. Auth: deferred — V1 ships public
**Decision:** No auth in V1. The app is publicly accessible during the pilot. Revisit before the Vikings go live with real volunteer data, and definitely before V2 multi-tenant.

**Rationale:**
- Single-tenant pilot with one known user. Auth complexity (magic links, session handling, OAuth-vs-app-auth interaction) is not load-bearing for the core loop.
- Removes a build-sequence dependency: we can ship steps 1–8 of the brief without resolving auth UX.
- The Drive and Square OAuth flows are per-integration and exist independently of app login — those still happen.

**Tradeoffs accepted:**
- Cannot ship to production until auth is added. This is a known revisit point, not an oversight.
- SMS opt-in/opt-out plumbing (step 9) needs a way to identify the requester even without app auth — likely a per-club secret URL until real auth lands.

**Future direction:** When we revisit, magic-link via Supabase Auth is the leading candidate (no password reset flows for the volunteer-chair persona).

### D5. Anthropic API call structure
**Decision:** Non-streaming responses with structured outputs via tool use (response_format / forced tool call). Prompt caching enabled on the system prompt and catalog context.

**Rationale:**
- Receipt parsing and CSV parsing are batch operations — we need the complete structured result before we can match against the catalog and write `stock_movements`. Streaming buys nothing here and complicates error handling.
- Forcing a tool call gives us schema-validated JSON without a second "did the model return valid JSON?" parse step.
- Prompt caching pays for itself fast: the system prompt + the club's catalog (which we send as context for fuzzy matching) is mostly static across calls within a parsing session.

**Alternatives considered:** Streaming with JSON mode (rejected — no UX benefit since parsing isn't user-facing in real-time); plain text output with regex extraction (rejected — fragile).

### D6. SignUp Genius: scraper + manual-paste fallback both in V1
**Decision:** Ship both ingestion paths in V1. Scraper is the convenience path (cron + manual refresh button); manual-paste textarea (parsed by Claude API into `volunteer_slots`) is the guarantee path.

**Rationale:**
- SignUp Genius can change their HTML or block scraping at any time. A scraper-only V1 is one DOM change away from a broken core feature.
- Manual paste is also faster to verify — if the chair sees stale data, she has a one-step recovery.
- Adds maybe a day of build time. Cheap insurance.

**ToS note (open):** Worth confirming SignUp Genius's ToS allows automated fetching of public pages before pilot launch. The manual-paste path is ToS-clean regardless.

### D7. Edge basic-auth — deferred. V1 ships truly public.
**Decision (revised 2026-04-30):** No basic-auth shield in V1. The Vercel deployment URL is publicly accessible. Earlier draft of this decision called for a basic-auth middleware as a pilot shield; user direction is to skip it and revisit alongside real auth.

**Rationale for deferring:**
- The pilot URL will not be advertised. Pilot ramp is one chair (Vikings concessions chair), so blast radius of public exposure is limited as long as we don't post the URL publicly.
- Build velocity over hardening: every layer skipped now is one less thing to debug while shipping the core loop.
- Real auth is still the right answer for production; basic-auth was always a stopgap. Skipping the stopgap and going straight to real auth (whenever D4 is resolved) is cleaner.

**Risks accepted:**
- Anyone who guesses or shares the Vercel URL can upload receipts, scrape SignUp Genius via our endpoint, and view volunteer names. Treat the URL itself as a soft secret.
- Square OAuth tokens and Drive OAuth tokens, once a club has connected them, will be associated with whoever clicked through. With no auth, there is no access control on those connected resources.

**What this means for build sequence:**
- No `middleware.ts` shield in V1.
- No `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` env vars.
- Real auth (D4) is the next gate before pilot launch with real Vikings data.

### D8. SMS via Twilio — deferred from V1
**Decision:** Twilio integration, A2P 10DLC registration, SMS volunteer reminders, and opt-in/opt-out plumbing are all deferred from V1. Originally listed in the brief as build sequence step 9 plus a definition-of-done item; both have been removed from the V1 scope.

**Rationale:**
- A2P 10DLC registration has a multi-week lead time and adds operational overhead before a single message can send. Cutting it from V1 saves calendar time and removes a non-software dependency from the critical path.
- The volunteer-coverage panel (build step 8) still delivers the core value: the chair can see who has signed up and what's still open. SMS was the action layer on top; we can ship the visibility layer alone.
- Re-adding SMS in V2 is additive — `volunteer_contacts` table stays in the schema dormant, ready to populate when SMS lands.

**What stays in V1:**
- `volunteer_contacts` table in the schema (unused, but provisioned to avoid a future migration).
- Volunteer coverage panel showing names and open slots.

**What drops:**
- Build sequence step 9 (Twilio SMS sender + opt-in/opt-out plumbing) — removed.
- Definition-of-done bullet about SMS reminders — removed.
- Twilio sender verification step in onboarding wizard — removed (wizard goes from 7 steps to 6).
- All Twilio env vars from SETUP.md.

### D9. Package manager: pnpm
**Decision:** Use pnpm for installs, scripts, and the lockfile. Not npm, not yarn. Pinned via `"packageManager": "pnpm@10.33.2"` in `package.json` so Corepack auto-locks the version per-repo.

**Rationale:**
- Smaller `node_modules` footprint via content-addressable store. Matters at $30/month infra ceiling.
- Vercel detects pnpm-lock.yaml automatically; no extra config.
- Stricter dependency hoisting catches accidental transitive imports — useful when this repo grows.

**Tradeoffs accepted:** Anyone joining the project needs pnpm available (`corepack enable pnpm` is sufficient — no global install required). Documented in SETUP.md step 1.

### D10. Stack versions: Next 15.5 + React 19.1 + Tailwind 4 + Turbopack
**Decision:** Accept the modern default stack as scaffolded by `pnpm create next-app@15`. Specifically:
- `next 15.5.15`
- `react 19.1.0` / `react-dom 19.1.0`
- `tailwindcss 4.2.4` (with `@tailwindcss/postcss`)
- `typescript ^5`
- `eslint 9`
- Turbopack as the default for both `next dev` and `next build`

**Why this differs from the brief:**
The brief specified "Next.js 14 (App Router)" and implied Tailwind 3 / React 18. Those were current at the time the brief was written. As of 2026-04-30, `create-next-app@15` ships React 19 and Tailwind 4 by default, and there is no supported flag combination that will scaffold React 18 + Tailwind 3 alongside Next 15 — you'd have to manually downgrade after the fact, fight the lockfile, and re-do tooling for every dep that has React-19-only types.

**What this changes downstream:**
- **Tailwind config style:** Tailwind 4 is CSS-first. Brand tokens go in `src/app/globals.css` under `@theme {}`, not in `tailwind.config.ts`. There is no `tailwind.config.ts` in V1 unless we add one for plugins.
- **Async cookies/headers in Next 15:** server-side `cookies()` and `headers()` are now async. Code touching these (auth flows, OAuth callbacks) must `await` them. Affects nothing in V1 yet because we're not wiring auth.
- **Turbopack default:** previously SETUP.md said "answer No to Turbopack." Reversed — Turbopack is stable in 15.5 for dev *and* build. We accept it.

**Tradeoffs accepted:**
- React 19 is recent enough that some integrations (notably some React libraries with peer-dep ranges) still warn. We address those case-by-case as they come up; nothing critical for V1.
- Tailwind 4 docs are newer and less SEO-saturated than v3 — if we need to look something up, the v4 docs at tailwindcss.com are the authoritative source.

**Smoke test on commit:** `pnpm typecheck` and `pnpm build` both pass clean on the empty scaffold.

### D11. Master Inventory Sheet — schema additions and observations
**Context:** User provided `BoosterIQ_Master_LagoVistaVikings_v1_2026-04-30.xlsx` on 2026-04-30. The structure has implications for the database schema we'll build in step 2 of the build sequence. Capturing observations now so they aren't lost between now and then.

**Sheets:** README · Catalog (133 rows) · Menu (409 rows) · Apparel & Merch (236 rows) · Recipes (V2) · Settings.

**Schema additions to `catalog_items` (not in original brief):**
- `code` — stable human-readable handle, format `CAT-XXXX` (zero-padded 4 digits). Useful for the chair to reference items in conversation. Database PK stays UUID.
- `square_token` — Square's stable item UID. **This is the primary match key**, not name. Survives Square renames.
- `reference_handle` — Square's slug-format handle (e.g. `#airhead-bars-2for-1-regular`). Secondary identifier.
- `category` — already implied; the master sheet uses simple strings ("Candy", "Drinks", "Accessories > Bags/Totes") with `>` for hierarchy. We can store as a single string in V1 and split on `>` for display.

**Match priority for Square CSV ingestion** (per the README sheet, codify this in the parser):
1. Square Token (most reliable — survives renames)
2. SKU (when present — ~44% of items have one)
3. Item Name + Variation (fragile — only used as last resort)

If none match, prompt the user to map or create — same flow described in the brief.

**Settings sheet drives club-level config** — these belong in a single-row `club_settings` table:
- `critical_par_buffer` — default `0.5` (games of runway → Critical)
- `low_par_buffer` — default `1.5` (games of runway → Low)
- `cost_change_threshold_pct` — default `5.0` (above this, flag for confirmation)
- `theme_primary` / `theme_accent` / `theme_dark` — already the Vikings palette, stored for V2 multi-tenant
- `signupgenius_url_pattern`, `square_location_id`, `google_drive_folder` — set during onboarding

**`Apparel & Merch` — resolved 2026-04-30: include in V1.**
Concessions and merch live in the same `catalog_items` table, distinguished by an `is_merch BOOLEAN` flag (default `FALSE`). The dashboard filters; the parser populates both from the master sheet's Catalog and Apparel & Merch tabs respectively. Reversal of the original "skip" recommendation — the chair gets one place to see all inventory, and the schema cost is one boolean column plus an index.

**Master sheet uses dollars; we store cents:** the parser converts on read. No special handling needed in the schema.

### D12. Master sheet parsing — direct, not via Claude API
**Decision:** Parse the master sheet xlsx with the `xlsx` (SheetJS) library directly. Skip Claude API for this input.

**Rationale:**
- The master sheet has a fully known structure (Catalog tab columns, Menu tab columns, Settings tab key-value rows). We mapped every column to a database field already (D11). There is nothing for Claude to interpret.
- Direct parse is deterministic, free, and runs in ~50ms. Claude API would be ~5-10s and ~$0.05-0.20 per parse, with non-zero hallucination risk on field values.
- Save Claude API for **receipts** (varied vendor formats, OCR-style image input) and **Square CSVs** (column variations across Square versions, ambiguous item-name matching). Those are the right places for it.

**Tradeoff accepted:** if a future club ships a master sheet with different column names, the direct parser will error rather than adapt. Acceptable for V1 single-tenant; in V2 we'd add a Claude-API fallback path or a config-driven column mapping.

### D13. Seed mechanism — one-shot script, not upload UI
**Decision:** For V1, seed the master sheet via a one-shot script (`pnpm seed:master-sheet`). Skip the upload UI.

**Rationale:**
- V1 is single-tenant. The master sheet gets seeded once for the Vikings, and re-run only on schema changes.
- An upload UI is ~half a day of work, used once. Building it for V2 (when multi-tenancy lands) is the right time.
- The script is idempotent (upsert by `code` for catalog_items; full rebuild for menu_items per run). Safe to re-run after master sheet edits.

**Tradeoff accepted:** the chair can't update the master sheet through the app in V1 — she edits the xlsx in Drive, you re-run the script. For V1's velocity goals this is fine; the brief's onboarding wizard (build sequence step 9) handles the user-facing flow once we get there.

### D14. Receipt photo storage — defer Drive for V1 step 4
**Decision:** For build sequence step 4 (receipt photo upload + Claude API parsing), parse the photo in-memory and store only the structured parse result in `receipts.parsed_data_json`. Skip persisting the photo file itself for now. `receipts.photo_url` becomes nullable via migration `20260430205639_make_receipts_photo_url_nullable.sql`.

**Why this differs from D3:**
D3 chose Google Drive as the file-storage layer for receipts and Square CSVs. That's still the right destination — but Drive integration requires Google Cloud Console OAuth setup + redirect-URI wiring + token-refresh plumbing, which is its own ~30-min vertical slice. Doing it inline with step 4 would block Claude-API receipt parsing on Drive setup.

**What ships in V1 step 4:**
- Receipt photo uploaded → parsed by Claude vision (forced tool use)
- Parsed line items matched against `catalog_items` by exact normalized name
- User confirms which matches to apply
- `receipts` row inserted with `photo_url=null`, `parsed_data_json` containing the full parse + match result
- `stock_movements` rows inserted for confirmed line items, `current_stock` updated

**What lands later:**
- Drive upload of the photo (call it step 4.5 — paired with the Drive OAuth setup we'll need anyway for Master Sheet read/write in onboarding)
- Cost-basis update + the >5% cost-change confirmation flow (step 4.5)
- Fuzzy catalog matching for non-exact names (step 4.5)

**Tradeoff accepted:** receipts created in V1 step 4 have no recoverable photo — only the parse result. If the chair wants to verify a parse, she has to re-photograph. Acceptable for the pilot since she's the one running every parse and can spot-check live.
