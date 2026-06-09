---
screen: mock-review
route: /mock (review state)
last-updated: 2026-06-08
status: draft
---

# Wireframe: Mock Review + Self-Grade

## Purpose
After the timed run, walk each question, reveal the model answer + checklist, self-grade. Flow: `mock-interview.md` step 3. Reuses `RevealPanel` + `ChecklistGrade`.

## Layout

```
┌──────────────────────────────────────────────┐
│ Review 2 / 5         your time 03:10  ⚑ over   │  ← per-Q meta (time, over-time flag)
│ ────────────────────────────────────────────  │
│  [System design]  Design a rate limiter…       │  ← prompt recap
│  Your answer:                                   │
│  ┌──────────────────────────────────────────┐ │
│  │ (what you typed; empty if skipped)        │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Model answer                                  │  ← RevealPanel content
│  ……                                            │
│                                                │
│  ChecklistGrade  (see component wireframe)     │  ← tick rubric → coverage% → suggested rating
│  Coverage 67%   Suggested: ◉ Good              │
│  [ Again ] [ Good* ] [ Easy ]                  │
│                                                │
│                         [ Next → ]             │
└──────────────────────────────────────────────┘

MCQ variant:
│  Your pick: B   ✓ Correct   (auto-scored 100)  │  ← no checklist; auto-graded
```

**Composition choice:** stacked editorial sections (recap → your answer → model → grade) in a reading column — mirrors how a candidate reviews, top to bottom.

## Components
| Component | Source | New? |
|---|---|---|
| RevealPanel (model answer) | existing | no (reused) |
| ChecklistGrade | feature-local | YES (own wireframe) |
| Rating buttons | existing (RevealPanel) | no |
| MCQ result row | feature-local | small |

## States
| State | Trigger | UI |
|---|---|---|
| reviewing | enter review | first question |
| empty-rubric | rubric == [] | no checklist; manual rating (graceful degrade) |
| mcq | QUIZ type | auto-graded correct/incorrect; no checklist |
| skipped | question was skipped | "Your answer: (skipped)"; coverage defaults 0 |
| saving | rating chosen | Next disabled until POST /api/answer ok |
| save-error | POST fails | inline retry on this question |

## Interactions
- Tick checklist items → live coverage % → suggested rating highlighted (overridable).
- Keyboard: 1/2/3 = Again/Good/Easy; Enter = Next.
- Each graded question writes an Attempt (advances SR).

## Data Needs
From the in-memory run (answers + times) + the question's rubric (already in run payload).

## Out of Scope
Editing the answer during review.
