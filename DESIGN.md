# Design Reference

V1 dashboard layout and design system, derived from the mockup approved on 2026-04-30. This document is the source of truth for visual decisions; the brief defines *what* the dashboard does, this defines *how it looks*.

## Color tokens

Per BUILD_BRIEF.md "Brand and visual design," restated here in token form for implementation.

### Brand
| Token | Hex | Usage |
|---|---|---|
| `--brand-royal` | `#1F4D9E` | Primary actions, header band, footer band, body button fill, primary metric value |
| `--brand-navy` | `#0F2C66` | Logo ring fill, deep accents |
| `--brand-gold` | `#F5C518` | Highlights, CTAs, "Report ready" pill, gold-icon quick actions, eyebrow text on header band |
| `--brand-cream` | `#FFF8E1` | Light-mode warm surfaces only (dark mode default in V1) |

### Dark mode neutrals (default)
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0F0F12` | Page background |
| `--card` | `#1A1A20` | Card surface |
| `--border` | `rgba(255,255,255,0.08)` | Subtle card borders |
| `--text-primary` | `#FFFFFF` | Headings, primary content |
| `--text-secondary` | `rgba(255,255,255,0.55)` | Subtext, metadata, "synced X ago" labels |
| `--text-muted` | `rgba(255,255,255,0.40)` | Eyebrow labels ("LATEST EVENT · JUST FINISHED") |

### Urgency tier system
Used on shopping list rows, volunteer role rows, and any inline status pill.

| Tier | Pill bg | Pill text | Row left-border | Row tinted bg |
|---|---|---|---|---|
| Critical | `#E84B26` (orange-red) | white | `#E84B26` | `rgba(232,75,38,0.08)` |
| Low | `#F5C518` (gold) | `#0F2C66` | `#F5C518` | `rgba(245,197,24,0.06)` |
| Filled | `#22C55E` (green) | white | `#22C55E` | `rgba(34,197,94,0.06)` |

## Typography

`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. No custom font load in V1.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Page title (header band) | 22px | 600 | "Lago Vista Vikings Booster" |
| Card title | 17px | 600 | "Shopping list — before Thursday", "Volunteer coverage — Thursday's game" |
| Metric value | 28px | 700 | "$1,847", "3 items" — colored by urgency |
| Body | 14px | 400 | Item descriptions, slot labels |
| Subtext | 12px | 400 | "12 left · runway 0.4 games" |
| Eyebrow / metadata | 11px | 600, uppercase, tracked | "LATEST EVENT · JUST FINISHED", "BOOSTERIQ · V1" |

Range: 11–28px. Stay inside this; resist the urge to introduce more sizes.

## Layout primitives

### Card
- Background `--card`
- 1px border `--border`
- Border-radius **12px**
- Padding **16–20px** (use 20px for top-level cards, 16px for nested rows)

### Header band
- Full-width, royal blue background, no border
- Height ~120px
- Logo (circular, navy fill, gold ring, gold monogram) on left, content right
- Eyebrow ("BOOSTERIQ · V1") in gold, uppercase, tracked
- Title in white, 22px/600
- Sub-meta in light gold/cream

### Footer band
- Full-width, royal blue, mirrors header
- Single line: "Next event: …" left, gold pill button right
- Same horizontal padding as the cards

### Tinted-row pattern (shopping list, volunteer roles)
- Card-within-card: rounded 10px, ~14px vertical / 16px horizontal padding
- Left border 3px, color = urgency tier
- Background tint = urgency tier (very subtle)
- Title in tier color, subtext in `--text-secondary`
- Right side: numeric badge + urgency pill

### Primary action button
- Full-width within its card
- Royal blue fill, white text, 12px radius
- ~46px tall
- Pairs with a smaller secondary outline button when two actions are needed (e.g. "Send" + "View roster")

### Quick actions grid
- 3 columns × 2 rows on desktop (responsive: 2 cols on tablet, 1 on mobile)
- Each cell: card with circular icon (40px, blue or gold fill) + label + sub-label
- Mix blue-fill and gold-fill icons across the grid for visual rhythm — not all one color

## Section composition (top to bottom)

1. **Header band** — club identity + sync status
2. **Latest event card** — gold left-border accent, "Report ready" gold pill top-right
3. **Three KPI cards** — equal-width grid: Gross sales (royal blue value), Reorder needed (orange-red value), Receipts logged (royal blue value)
4. **Shopping list card** — title + "Auto-generated" right-meta, tinted rows by urgency, full-width primary action at bottom
5. **Volunteer coverage card** — title + "SignUp Genius · synced Xh ago" right-meta, summary line, progress bar, tinted role rows, primary + secondary action pair at bottom
6. **Quick actions card** — 6-cell grid
7. **Footer band** — next event preview + gold "Game prep" pill

## Mockup deltas (must address before pixel-matching)

The mockup was produced before the 2026-04-30 scope decisions. Three things in it no longer match the agreed V1:

### 1. Header eyebrow says "CONCESSIONIQ · V1"
Per [DECISIONS.md D1](./DECISIONS.md#d1-project-name-boosteriq), canonical name is **BoosterIQ**. Implement the eyebrow as `BOOSTERIQ · V1`.

### 2. Volunteer coverage card has "Send SMS reminder ↗" full-width button
Per [DECISIONS.md D8](./DECISIONS.md#d8-sms-via-twilio--deferred-from-v1), Twilio is deferred from V1. Replace this CTA. Two reasonable options:
- **"Copy roster to clipboard"** — quick, no service dependency, lets the chair paste into her own SMS/email app
- **"Email me the gaps"** — uses mailto: with prefilled body; no infra cost

Recommend **"Copy roster to clipboard"** for V1 — zero setup, useful immediately. The "View roster" secondary stays.

### 3. Shopping list card has "Send list to my phone ↗" full-width button
Same SMS implication. Replace with one of:
- **"Copy to clipboard"** (recommended)
- **"Print list"** — uses native print dialog, paper-friendly for the supply run
- **"Save as PDF"** — same print dialog, just save target

Recommend **"Print list"** as primary (matches the printable-PDF muscle memory the chair already has) with **"Copy"** as secondary.

## Implementation notes (when we get to UI)

- Use Tailwind for everything. No CSS-in-JS, no styled-components.
- **Tailwind 4 is CSS-first** (per [DECISIONS.md D10](./DECISIONS.md#d10-stack-versions-next-155--react-191--tailwind-4--turbopack)). Brand tokens go in `src/app/globals.css` under a `@theme {}` block, not in a `tailwind.config.ts` file. Pattern:
  ```css
  @import "tailwindcss";
  @theme {
    --color-brand-royal: #1F4D9E;
    --color-brand-navy: #0F2C66;
    --color-brand-gold: #F5C518;
    --color-urgency-critical: #E84B26;
    --color-urgency-low: #F5C518;
    --color-urgency-filled: #22C55E;
  }
  ```
  These auto-generate utility classes (`bg-brand-royal`, `text-urgency-critical`, etc.) — use those, not raw hex.
- Cards as a reusable component: `<Card>`, `<CardHeader>`, `<CardBody>`, `<CardAction>`. Keep the API tight — three or four props, not a dozen.
- Urgency tier as a discriminated union type: `type Urgency = 'critical' | 'low' | 'filled'`. Render the pill, the row tint, and the left border off the same value.
- All measurements in rem-or-px-multiples-of-4. Resist arbitrary values.

## What's intentionally *not* specified yet

- Light mode palette beyond `--brand-cream`. Dark mode ships first; light mode is a stretch goal.
- Mobile breakpoints. The mockup is desktop-width; we'll establish responsive rules when we wire the first real card component.
- Empty states (no events yet, no receipts yet). To be designed during build sequence step 6 (dashboard read-only).
- Loading states. Default to subtle skeleton pulses on cards; specifics during step 6.
