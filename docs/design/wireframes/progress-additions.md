---
screen: progress-additions
route: /progress
last-updated: 2026-06-08
status: draft
---

# Wireframe: Progress Additions (due review + weak areas)

## Purpose
Add two "what next" signals to the existing `app/progress` page (issue 006): a due-review entry and weak-area highlighting. Reuses `getProgressSummary` (`lib/progress.ts`).

## Layout (additions to existing progress page)

```
┌──────────────────────────────────────────────────────────┐
│  Progress                                                 │
│  [Attempts 42] [Avg 71] [Topics 18/60]                    │  ← existing Stat row
│                                                           │
│  ⏰ Due for review (4)                       [Review now →]│  ← NEW banner; hidden if 0 due
│     Most overdue first: Rate limiting, CAP, TLS, …        │
│                                                           │
│  Weak areas (avg < 60)                                    │  ← NEW section; hidden if none
│   Rate limiting   50  [Practice]                          │
│   Consensus       55  [Practice]                          │
│                                                           │
│  All topics                                               │  ← existing table, weak rows tinted
│   Topic        Attempts  Avg   Last     Next review       │
│   …            …         50⚑   …        due (red)         │
└──────────────────────────────────────────────────────────┘
```

**Composition choice:** insert a prominent due-review banner above the existing table (action-first), and a small weak-areas list — additive, keeps the current table layout.

## Components
| Component | Source | New? |
|---|---|---|
| DueBanner (count + Review now) | feature-local | YES |
| WeakAreaList | shared with scorecard | reuse |
| Existing progress table + Stat | existing | reuse (Stat extracted per 009) |

## States
| State | Trigger | UI |
|---|---|---|
| none-due | 0 topics past nextDue | hide DueBanner |
| has-due | ≥1 due | banner with count, ordered most-overdue-first |
| no-weak | no topic avg < 60 | hide weak section |
| empty-overall | no attempts yet | existing empty state ("pick a topic") |

## Interactions
- "Review now" → starts a due-driven session (topics nextDue ≤ now first).
- Weak topic "Practice" → deep-link `/practice?topicSlug=…&type=…`.
- Due rows in the table tinted; weak avg flagged with icon + color (not color-only — also ⚑).

## Data Needs
`getProgressSummary()` (already returns attempts/avg/lastSeen/nextDue/due). Add ordering by overdue + weak filter (avg < 60) — pure derive, no schema change.

## Out of Scope
Configurable thresholds; per-type weak breakdown (scorecard covers per-run).
