---
audited: 2026-06-08
target: docs/design/design-system.md + app/globals.css + components
product-type: developer-tool / study-app
corpus-benchmark: none (no docs/design/trend-*.md — corpus-delta half skipped)
genericness-score: 0.38
band: mostly-fine
---

# Anti-generic design audit — interview-prep (post-redesign)

## 13-tell checklist
| # | Tell | Result | Note |
|---|---|---|---|
| T1 | Default font | ⚑ flag | Geist Sans + Geist Mono only; mono-numerals is a deliberate device (rationale ✓) but there is no distinct **display** face — hero still in the body family |
| T2 | Slate-only neutrals | ✅ pass | blue-tinted near-black ramp (#0b0f14 → #11161d → #161c24), not a flat slate ramp; rationale in design-system.md |
| T3 | Single safe accent | ✅ pass | one **cyan** accent (not the default purple/blue), chosen to avoid the semantic-green collision; restraint is intentional for a dev tool |
| T4 | KPI-grid headline | ✅ pass | dashboard opens with a display headline + mono meta line; stats are secondary, not the lead |
| T5 | Rigid symmetric grid | ⚑ flag | everything sits on one centered `max-w-5xl`; no asymmetry / rail / break-out |
| T6 | Uniform radius | ✅ pass | intentional sharp 6px (`rounded-md`) + `rounded-full` pills; rationale = technical feel |
| T7 | Generic shadow stack | ✅ pass | borders-over-shadows on dark; no soft rgba shadow stack |
| T8 | No / generic motion | ⚑ flag | motion **tokens** defined but UI only uses default `transition-colors/opacity`; no real personality (timer pulse, step fade, focus motion) implemented |
| T9 | Gradient-blob hero | ✅ pass | text hero, no gradient mesh/blob |
| T10 | Centered max-w everything | ⚑ flag | every section centered max-w; no full-bleed header rule, no wide table, no break-out |
| T11 | Emoji-as-icon | ⚑ flag | ⏰ ⚑ 📖 ✓ ✗ ⏱ used as the icon system (⌁ brand glyph is fine); no real icon set |
| T12 | One-weight typography | ✅ pass | bold display + semibold + normal + mono meta |
| T13 | No layout personality | ✅/◑ borderline | dashboard hero + mono numerals give dev-tool character; topics/progress still cards/standard table |

**Flags: 5/13 → genericness 0.38 (top of "mostly-fine").** The palette, numerals, accent, shadow, hero, and type-weight moves are genuinely divergent; what remains generic is **icon system, display face, layout composition, and real motion**.

> Corpus-delta benchmark skipped — no `docs/design/trend-developer-tool.md`. Run `/design-trend-compare` to benchmark against captured dev-tool leaders (Linear, Vercel, Raycast, Warp) for a sharper target.

## Divergent moves (prioritized)
1. **[T11] Replace emoji with a real icon set.** Add `lucide-react`; swap ⏰→`Clock`, ⚑→`Flag`/`TriangleAlert`, 📖→`BookOpen`, ✓/✗→`Check`/`X`, ⏱→`Timer`. Keep `⌁` as the single brand mark. Biggest credibility win.
2. **[T1] Give the hero a display identity.** Either set h1/h2 in **Geist Mono uppercase** (doubles down on the terminal identity) or add one grotesk display face for headings only. Make the dev-tool voice unmistakable.
3. **[T5/T10] Break the centered monotony.** Full-bleed sticky header hairline; dashboard as hero (left) + due/weak **rail** (right) on desktop; make the progress table full-width with a left tier gutter. One asymmetric move per primary screen.
4. **[T13] Make Topics a dense "index", not uniform cards.** A monospace, tier-grouped list/table (rank · topic · score · attempts · due) reads more like a dev tool than the cards-in-a-grid.
5. **[T8] Implement real micro-motion (reduced-motion aware).** Timer "over" pulse, answer-reveal step fade, row hover lift, accent focus-ring transition — wire the tokens, don't just declare them.

## Verdict
Not "every AI app" — it reads as a deliberate dark dev-tool (0.38). To get into the **distinctive** band (≤0.15), do moves 1–3 (icons, display face, one asymmetric layout move per screen).
