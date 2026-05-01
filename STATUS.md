# Build status

Living doc — updated as the build progresses. Read this first when picking up a session.

Last updated: 2026-05-01

## Where we are

Per the build sequence in [BUILD_BRIEF.md](./BUILD_BRIEF.md):

| # | Step | Status | Verified live? |
|---|---|---|---|
| 1 | Project scaffold (Next 15, deps, tooling) | ✅ Complete | yes — `pnpm typecheck` + `pnpm build` clean |
| 2 | Database schema + migrations | ✅ Complete | yes — all 10 tables exist + seeded Vikings club |
| 3 | Master sheet ingestion → catalog_items | ✅ Complete | yes — 131 concessions + 235 merch + 408 menu items, run via `pnpm seed:master-sheet` |
| 6 | Dashboard read-only with seeded data | ✅ Complete | yes — http://localhost:3000 renders correctly |
| 4 | Receipt upload + Claude vision parsing | 🟡 Code complete, **untested live** | NO — blocked on Anthropic credit balance |
| 5 | Square CSV upload + sales depletion math | ✅ Code complete | parser has 6 unit tests; live-tested needs a real Square Item Sales CSV |
| 7 | SignUp Genius scraper + manual paste fallback | ✅ Code complete | scraper untested live (need a real URL); paste parser has 6 passing unit tests |
| 8 | Volunteer panel | ✅ Code complete | dashboard now reads volunteer_slots when present; UI tested empty-state |
| 9 | Conversational onboarding wizard | ⏭️ Not started | — |
| 10 | PDF report generator | ⏭️ Not started | — |
| 11 | Polish, error states, edge case handling | ⏭️ Not started | — |

(Build steps run out of brief order: 6 came before 4 so we'd have a working dashboard to demo while iterating on parsing.)

## Active blocker — Anthropic credit balance

Step 4 is fully built and the auth path works (request reached `api.anthropic.com`, got an `org_id` back), but every parse request returns:

```
400 invalid_request_error: Your credit balance is too low to access the Anthropic API
```

User believes credits are "on reserve" but the API still rejects. Likely causes:
- Payment method added but credits not actually purchased (Anthropic is pay-as-you-go — adding a card ≠ buying credits)
- Different organization than the one the API key belongs to (the key's org ends in `...79ae7b` per the response headers — verify in console.anthropic.com org switcher)
- Free-trial credits expired and need top-up

**To resume:** open https://console.anthropic.com/settings/billing → confirm correct org → click *Add credits* (or *Buy credits*) → minimum $5 → wait ~30 seconds → retry upload at http://localhost:3000/receipts/upload.

## Pending TODOs (not blocking, but worth doing)

1. **Rotate the leaked Anthropic key** — `sk-ant-api03-pzTx-xHx6y1Y...` was hex-dumped earlier into the chat transcript. Revoke at https://console.anthropic.com/settings/keys; replace in `.env.local`.
2. **First live test of the receipt parser** — once credits land, upload one of the sample receipts (Sam's Club / HEB / Costco). Watch for: vendor extraction accuracy, line-item count vs receipt, catalog match rate, total reconciliation flag.
3. **First live test of the SignUp Genius scraper** — need a real Vikings game's public sign-up URL. Add an event via `/events/new` with that URL, then click `Sync roster` from the dashboard. If parse fails, the manual paste fallback is the alternative.
4. **Fuzzy catalog matching** (deferred from step 4 first pass) — the brief specifies fuzzy match for medium-confidence cases. Currently we do exact normalized-name match only. Add Levenshtein or trigram match before the live demo.
5. **Cost-basis update + cost-change flag** (deferred from step 4 first pass) — when a parsed unit price differs from `catalog_items.cost_basis_cents` by >5%, prompt for confirmation per BUILD_BRIEF.md. Currently unused.
6. **Claude-based paste parser** (D15 swap-in) — when Anthropic credits are live, swap the regex paste parser for a Claude-API parser per D6. Tests stay; current regex stays as offline fallback.
7. **Drive integration** for receipt photo persistence — D14 explicitly defers this. Ties together with the master-sheet Drive read/write needed for onboarding (step 9). Probably worth bundling into one "Drive vertical slice" before/with step 9.

## How to resume

```
cd /Users/justinloucks/projects/BoosterIQ
git pull                    # if the repo moved on a different machine
pnpm install                # in case deps changed
pnpm dev                    # start dev server in YOUR terminal — not via Claude
                            # (Claude Code's sandbox sets ANTHROPIC_API_KEY="" which
                            # shadows .env.local; native shell does not)
```

Read [DECISIONS.md](./DECISIONS.md) (D1–D14) for architectural context.

## Environment state

- GitHub: https://github.com/Kilojack82/BoosterIQ — `main` is at `a89ad91` (Build receipt upload + Claude vision parsing)
- Supabase project: `gwccxjohevjszmowjrpx` — schema + Vikings seed live
- All env vars in `.env.local` populated **except** `GOOGLE_CLIENT_ID/SECRET` and `SQUARE_*` (not needed until steps 5 / Drive integration)
- Anthropic API key in `.env.local` is valid (108 chars) but billing rejects calls
