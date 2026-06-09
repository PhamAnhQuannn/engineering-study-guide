---
screen: mock-scorecard
route: /mock (scorecard state)
last-updated: 2026-06-08
status: draft
---

# Wireframe: Mock Scorecard

## Purpose
End-of-mock summary: overall + per-type + per-topic + weak areas + over-time. Flow: `mock-interview.md` step 4. Computed in-memory.

## Layout

```
┌──────────────────────────────────────────────────────────┐
│  Mock complete · Senior Backend Loop · 5 questions        │
│                                                           │
│  Overall  72        ⏱ 2 over time   ✎ 1 skipped           │  ← headline (not a 4-up KPI grid)
│                                                           │
│  By type                                                  │
│   Knowledge ▓▓▓▓▓▓▓░ 80                                    │  ← horizontal bars
│   Coding    ▓▓▓▓▓░░░ 60                                    │
│   Design    ▓▓▓▓░░░░ 50  ⚑ weak                            │
│   Behavioral▓▓▓▓▓▓▓▓ 95                                    │
│                                                           │
│  By topic                                                 │
│   Rate limiting        50  ⚑ weak                          │
│   Caching              80                                  │
│   …                                                       │
│                                                           │
│  Weak areas → [Practice these]   (deep-links to practice) │
│                                                           │
│  [ Review answers ]            [ Done → dashboard ]        │
└──────────────────────────────────────────────────────────┘
```

**Composition choice:** an editorial report — one headline number + labeled bar sections — deliberately NOT a uniform Stat-card grid (the bars communicate relative weakness at a glance; reusing `Stat` only for the headline).

## Components
| Component | Source | New? |
|---|---|---|
| Stat (headline) | existing (extract per issue 009) | reuse |
| ScoreBar (labeled horizontal) | feature-local | YES |
| WeakAreaList (deep-links) | feature-local | small |

## States
| State | Trigger | UI |
|---|---|---|
| full | all questions graded | as drawn |
| partial-abort | run ended early | "Partial — N of M graded"; show graded only |
| empty | nothing graded (all skipped, no grade) | "No graded questions" + back to setup |

## Interactions
- "Practice these" / weak topic → deep-link `/practice?topicSlug=…&type=…`.
- "Review answers" → re-enter review (read-only).
- Done → dashboard.

## Data Needs
In-memory run results only (no fetch). Scorecard aggregation from `lib/mock.ts`.

## Out of Scope
Persistent scorecard history (no MockSession in v1).
