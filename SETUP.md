# Setup

End-to-end checklist for getting BoosterIQ running locally and deployed to Vercel. V1 ships publicly accessible — no app auth, no basic-auth shield, no SMS. See [DECISIONS.md](./DECISIONS.md) D4, D7, D8 for the rationale on what was deferred.

> **Soft-secret reminder:** because there is no auth gate in V1, the Vercel deployment URL itself is the access control. Don't post it publicly, don't share it in unprotected channels, and assume it's compromised the moment it leaves a trusted hand.

---

## 1. Local toolchain

- [ ] **Node.js 20.x** — install via `nvm` (`nvm install 20 && nvm use 20`)
- [ ] **pnpm** — `npm install -g pnpm` (per [DECISIONS.md D9](./DECISIONS.md#d9-package-manager-pnpm))
- [ ] **Git** — initialize the repo: `git init && git add . && git commit -m "Initial scaffolding"`
- [ ] **Vercel CLI** — `npm install -g vercel`
- [ ] **Supabase CLI** — `brew install supabase/tap/supabase`
- [ ] **gh CLI** (optional, for PR workflows) — `brew install gh`

## 2. Service accounts (gather before scaffold)

Each row produces one or more env vars. Collect them all into a working scratch doc; we'll write `.env.local` once everything is gathered.

| Service | Action | Env vars produced |
|---|---|---|
| **Anthropic** | Create API key at console.anthropic.com | `ANTHROPIC_API_KEY` |
| **Supabase** | Create project at supabase.com → copy URL + anon + service-role keys | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Google Cloud** | Create project → enable Drive API + Sheets API → create OAuth 2.0 client (Web application) → add `http://localhost:3000/api/auth/google/callback` and the Vercel URL as redirect URIs | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Square** | Sandbox app at developer.squareup.com → OAuth credentials → set redirect URL | `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET`, `SQUARE_ENVIRONMENT=sandbox` |
| **Vercel** | Sign in via `vercel login`. Don't link the project yet — we link in step 5. | (none yet) |

## 3. Project scaffold (build sequence step 1 begins here)

- [ ] From this directory: `pnpm create next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"`
  - Answer **No** to "Use Turbopack" (stick with webpack for V1 — fewer surprises).
- [ ] Install runtime deps:
  ```
  pnpm add @supabase/supabase-js @anthropic-ai/sdk googleapis square cheerio zod
  ```
- [ ] Install dev deps:
  ```
  pnpm add -D prettier eslint-config-prettier vitest @vitest/ui
  ```
- [ ] Enable TypeScript strict mode in `tsconfig.json` (`"strict": true`, `"noUncheckedIndexedAccess": true`)
- [ ] Add Prettier config (`.prettierrc`) and wire `pnpm format` / `pnpm format:check` scripts

## 4. Environment files

- [ ] Write `.env.local` with every var collected in step 2. This file is gitignored — never commit it.
- [ ] Write `.env.example` (committed, no secrets) listing every variable name with an empty value, so anyone who clones the repo knows what they need.
- [ ] Smoke test: `pnpm dev` → visit `http://localhost:3000` → see the Next.js default page.

## 5. Vercel project + first deploy

- [ ] `vercel link` — choose "create new project," accept the defaults
- [ ] `vercel env add` for every variable in `.env.local` (mark as Production, Preview, and Development as appropriate; secrets like `SUPABASE_SERVICE_ROLE_KEY` should NOT be exposed to Preview by default)
- [ ] `vercel --prod` — first deploy
- [ ] Visit the production URL → confirm the app loads. Treat the URL as a soft secret going forward.

## 6. Supabase database

- [ ] `supabase init` (creates `supabase/` directory)
- [ ] `supabase link --project-ref <your-project-ref>`
- [ ] Build sequence step 2 (database schema with all migrations) starts here.

## 7. Sample data fixtures

The brief promises:
- 5 sample receipts (Sam's Club, Costco, HEB, two generic) as JPG/PDF
- 3 sample Square CSV exports
- The Vikings Booster's existing inventory list as CSV
- One real SignUp Genius URL

Place all of this in `fixtures/private/` — gitignored per `.gitignore`. Build sequence step 3 (Master Sheet upload + parsing) consumes this material first.

---

## Quick reference: env var inventory

```
# Anthropic
ANTHROPIC_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Drive / Sheets
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Square
SQUARE_APPLICATION_ID=
SQUARE_APPLICATION_SECRET=
SQUARE_ENVIRONMENT=sandbox
```

---

## Deferred (not part of V1 setup)

- **Twilio / SMS** — see [DECISIONS.md D8](./DECISIONS.md#d8-sms-via-twilio--deferred-from-v1). When SMS lands, add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` env vars and submit A2P 10DLC registration (multi-week lead time).
- **App authentication** — see [DECISIONS.md D4](./DECISIONS.md#d4-auth-deferred--v1-ships-public). Magic-link via Supabase Auth is the leading candidate.
- **Edge basic-auth shield** — see [DECISIONS.md D7](./DECISIONS.md#d7-edge-basic-auth--deferred-v1-ships-truly-public). Skipped entirely; we'll go straight to real auth when D4 lands.
