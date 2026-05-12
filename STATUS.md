# Build status

Living doc — updated as the build progresses. Read this first when picking up a session.

Last updated: 2026-05-12

## Where we are

Per the build sequence in [BUILD_BRIEF.md](./BUILD_BRIEF.md):

| # | Step | Status | Verified live? |
|---|---|---|---|
| 1 | Project scaffold (Next 15, deps, tooling) | ✅ Complete | yes — `pnpm typecheck` + `pnpm build` clean |
| 2 | Database schema + migrations | ✅ Complete | yes — all 10 tables exist + seeded Vikings club |
| 3 | Master sheet ingestion → catalog_items | ✅ Complete | yes — 131 concessions + 235 merch + 408 menu items, run via `pnpm seed:master-sheet` |
| 6 | Dashboard read-only with seeded data | ✅ Complete | yes — http://localhost:3000 renders correctly |
| 4 | Receipt upload + Claude vision parsing | 🟡 Code complete, **upload-to-parse roundtrip untested live** | API auth verified 2026-05-12 (HTTP 200 against `claude-haiku-4-5-20251001`). Full receipt UI roundtrip still pending. |
| 5 | Square CSV upload + sales depletion math | ✅ Code complete | parser has 6 unit tests; live-tested needs a real Square Item Sales CSV |
| 7 | SignUp Genius scraper + manual paste fallback | ✅ Code complete | scraper untested live (need a real URL); paste parser has 6 passing unit tests |
| 8 | Volunteer panel | ✅ Code complete | dashboard now reads volunteer_slots when present; UI tested empty-state |
| 9 | Conversational onboarding wizard | ⏭️ Not started | — |
| 10 | PDF report generator | ✅ Code complete | print-stylesheet approach (Cmd+P → Save as PDF). Tested by visiting /events/[id]/report; print preview shows clean layout |
| 11 | Polish, error states, edge case handling | ⏭️ Not started | — |

(Build steps run out of brief order: 6 came before 4 so we'd have a working dashboard to demo while iterating on parsing.)

## Recently resolved

- **Anthropic credit balance** (was an active blocker on 2026-05-01). Credits added to the correct org on 2026-05-12; key tested live with a minimal call against `claude-haiku-4-5-20251001` → HTTP 200, valid response. Receipt-parser code path is unblocked for live testing.
- **Dashboard visual refresh** (2026-05-12, commits `600b2f6` + `ff2b886`). ESPN/broadcast aesthetic layered onto the existing brand palette — Bebas Neue display font (via `next/font/google`), `--color-card-warm` action surface on the shopping list, `--color-live` ESPN-red ticker badge, new utility classes (`.broadcast-num`, `.jersey-stripes`, `.stadium-glow`), and a NewsTicker component above the dashboard. All functionality, routes, and data flow unchanged. See [DESIGN.md](./DESIGN.md) for the updated token + typography spec and `design/mockups/` for the v1/v2 visual references that drove the change.

## Pending TODOs (not blocking, but worth doing)

1. ~~**Rotate the leaked Anthropic key**~~ — user reviewed exposure on 2026-05-12 and explicitly opted to keep the current key. If usage patterns ever look anomalous in `console.anthropic.com` (unexpected billing, foreign IPs, requests you didn't make), revoke and reissue immediately — takes <2 minutes once committed.
2. **First live test of the receipt parser** — credits are now live, API auth verified, but the full UI upload-to-parse roundtrip hasn't been exercised. Run `pnpm dev` in a native terminal (not Claude Code), open http://localhost:3000/receipts/upload, upload one of the sample receipts (Sam's Club / HEB / Costco). Watch for: vendor extraction accuracy, line-item count vs receipt, catalog match rate, total reconciliation flag.
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

- GitHub: https://github.com/Kilojack82/BoosterIQ — `main` is at `ff2b886` (Header: "Booster IQ" eyebrow, club name bumped to 40px)
- Supabase project: `gwccxjohevjszmowjrpx` — schema + Vikings seed live
- All env vars in `.env.local` populated **except** `GOOGLE_CLIENT_ID/SECRET` and `SQUARE_*` (not needed until steps 5 / Drive integration)
- Anthropic API key in `.env.local` is valid (108 chars) and billing is live — verified 2026-05-12
