---
last-updated: 2026-06-08
tailwind: v4 (CSS-first @theme in app/globals.css)
direction: developer-tool / technical, dark-first
---

# Design System — Interview Prep

Developer-tool aesthetic for a senior-SWE audience: **dark-first**, restrained, precise. One accent (**cyan**). Monospace for all numerals/meta/stats; tight sans for display. Borders over shadows on dark. Sharp-ish radius (technical, not bubbly).

## Color Tokens

Dark is the **default** (`:root`); light applies only under `prefers-color-scheme: light`.

| Token | Dark (default) | Light | Tailwind utility | Use |
|---|---|---|---|---|
| background | `#0b0f14` | `#ffffff` | `bg-background` | page |
| surface | `#11161d` | `#f6f8fa` | `bg-surface` | cards, panels |
| surface-2 | `#161c24` | `#eef1f4` | `bg-surface-2` | nested / hover |
| foreground | `#e6edf3` | `#0b0f14` | `text-foreground` | body |
| muted | `#8b949e` | `#57606a` | `text-muted` | meta, labels |
| border | `#232b36` | `#d0d7de` | `border-border` | dividers, card edges |
| accent | `#22d3ee` (cyan-400) | `#0891b2` (cyan-600) | `bg-accent` / `text-accent` | ONE accent: primary CTAs, links, focus, active |
| accent-foreground | `#06141a` | `#ffffff` | `text-accent-foreground` | text on accent |

**Score semantics (unchanged, `lib/score.ts`)** — these are the ONLY other colors: red `<50`, amber `<70`, blue `<85`, green `≥85`. Accent is cyan precisely so it never collides with the green "good" signal.

**Rules:** never raw hex in components — use the utility. Accent is reserved (CTA / link / focus / active) — don't sprinkle it. No `text-gray-*`/`slate-*` — use `text-muted`.

## Typography
- **Display / headings:** Geist Sans, bold, tight tracking (`-0.02em`). `text-2xl`/`3xl`/`4xl`.
- **Body:** Geist Sans, 16/24.
- **Mono (the signature move):** Geist Mono + `tabular-nums` for ALL numbers, stats, timers, counts, topic scores, and small UPPERCASE meta labels (`text-xs uppercase tracking-wider text-muted`). This is what reads "developer tool".

| Token | Class |
|---|---|
| display | `text-3xl md:text-4xl font-bold tracking-tight` |
| h2 | `text-xl font-semibold tracking-tight` |
| body | `text-base` |
| meta | `font-mono text-xs uppercase tracking-wider text-muted` |
| number | `font-mono tabular-nums` |

## Radius
Lean sharp: `--radius` = 6px. Cards/buttons `rounded-md` (6px), inputs `rounded` (4px), pills/avatars `rounded-full`. No big bubbly `rounded-2xl`.

## Elevation
Dark mode = **borders, not shadows**. Cards = `bg-surface border border-border`. Hover = `bg-surface-2` or `border-accent/40`. Shadows only for true overlays (modal) and kept subtle.

## Motion
Fast + mechanical. `--dur-fast 120ms`, `--dur-base 180ms`, ease `cubic-bezier(0.2,0,0,1)`. Hover/focus = fast; reveal/step = base. Timer "over" pulse honors `prefers-reduced-motion` (color/text only when reduced). No decorative motion.

## Focus
Visible cyan ring on every interactive: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ring-offset-background`.

## Component Inventory (no shadcn in this repo — bespoke + Tailwind)

| Component | File | Treatment |
|---|---|---|
| Header/nav | `app/layout.tsx` | sticky, `bg-background/80 backdrop-blur`, `⌁` mono brand, accent active link |
| Stat card | `components/Stat.tsx` | `bg-surface border-border`, mono `tabular-nums` value, uppercase mono label |
| Topic card | `app/page.tsx` | `bg-surface border-border`, hover `border-accent/40`, mono score |
| Panel | `app/page.tsx` | `bg-surface border-border` |
| Primary button | many | `bg-accent text-accent-foreground rounded-md` (was `bg-foreground`) |
| Secondary/ghost | many | `border-border` / hover `bg-surface-2` |
| Rating buttons | `components/RevealPanel.tsx` | keep semantic red/blue/green; suggested = `ring-2 ring-current` |
| Checklist | `components/ChecklistGrade.tsx` | `fieldset bg-surface border-border`, `accent-cyan` checkboxes |
| Score bar | `app/mock/page.tsx` | track `bg-surface-2`, fill `bg-accent` |
| Timer | `app/mock/page.tsx` | mono `tabular-nums`; over = red + pulse |
| Table | `app/progress/page.tsx` | `border-border` rows, mono numerals |
| Inputs | `app/mock` builder | `bg-surface border-border rounded focus ring-accent` |

## Usage Rules / Anti-generic guardrails
- ONE accent (cyan). KPI headline is NOT a generic 4-card grid — dashboard leads with a display headline + mono meta line, stats secondary.
- Numerals are mono+tabular everywhere (the differentiator). Don't set numbers in the sans body.
- Borders define cards on dark; avoid drop-shadow stacks.
- Don't drift to slate-on-slate: muted text uses `text-muted`, surfaces step `background → surface → surface-2`.
- Radius stays small/consistent (technical), not bubbly.

## Out of scope
Logo mark beyond the `⌁` glyph; marketing site; full light-mode polish (functional but dark is the designed default).
