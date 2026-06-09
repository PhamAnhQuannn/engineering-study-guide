---
screen: checklist-grade (component)
route: used in /practice + /mock review
last-updated: 2026-06-08
status: draft
---

# Wireframe: ChecklistGrade (component)

## Purpose
Render a question's rubric as tickable items, show live coverage %, and surface the suggested (overridable) rating. Used inside `RevealPanel` (practice) and mock review. Flow: `docs/design/flows/checklist-grade.md`.

## Layout

```
┌──────────────────────────────────────────────┐
│ What a strong answer covers                    │  ← label
│  ▢ Defines the collision case                  │  ← checkbox + item
│  ▣ Names ≥2 resolution strategies              │
│  ▢ Mentions load factor / resize               │
│                                                │
│  Coverage 33%   ·  Suggested: Again            │  ← live; updates on tick
│  [ Again* ] [ Good ] [ Easy ]                  │  ← * = suggested, preselected, overridable
└──────────────────────────────────────────────┘

Empty-rubric state (graceful degrade): component renders NOTHING.
RevealPanel then shows model answer + plain [Again][Good][Easy] (current behavior).
```

**Composition choice:** plain checklist list (no card chrome) so it sits naturally inside RevealPanel; rating row reuses the existing RateButton styling.

## Components
| Component | Source | New? |
|---|---|---|
| Checkbox + label rows | feature-local | YES |
| Coverage/suggestion line | feature-local | small |
| RateButton row | existing (RevealPanel) | reuse |

## States
| State | Trigger | UI |
|---|---|---|
| empty | rubric == [] | renders null (degrade) |
| unticked | reveal | all boxes empty, coverage 0%, suggested Again |
| partial | some ticked | coverage updates, suggestion recomputed |
| all-ticked | all ticked | coverage 100%, suggested Easy |
| overridden | user picks ≠ suggestion | chosen button active; coverage still recorded |

## Interactions
- Tick/untick recomputes coverage via `lib/rubric.ts` `coverage()` + `suggestRating()`.
- Suggested rating is preselected but any rating is clickable.
- Keyboard: each item focusable (space toggles); 1/2/3 select rating.
- Emits `{ rating, coverage }` to the parent on submit.

## Data Needs
`rubric: string[]` from the question payload (`api/generate` / run payload). No fetch.

## Props (interface sketch)
`{ rubric: string[]; onGrade: (rating, coveragePct) => void; busy?: boolean }`

## Out of Scope
Per-item weighting (all items equal weight in v1).
