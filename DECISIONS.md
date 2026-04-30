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
**Decision:** Use pnpm for installs, scripts, and the lockfile. Not npm, not yarn.

**Rationale:**
- Smaller `node_modules` footprint via content-addressable store. Matters at $30/month infra ceiling.
- Vercel detects pnpm-lock.yaml automatically; no extra config.
- Stricter dependency hoisting catches accidental transitive imports — useful when this repo grows.

**Tradeoffs accepted:** Anyone joining the project needs pnpm installed (`npm i -g pnpm`). Documented in SETUP.md step 1.
