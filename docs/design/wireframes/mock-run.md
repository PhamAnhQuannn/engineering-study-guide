---
screen: mock-run
route: /mock (run state)
last-updated: 2026-06-08
status: draft
---

# Wireframe: Mock Run (timed, no reveal)

## Purpose
Answer one question at a time under a soft timer; no model answer shown until the run ends. Flow: `mock-interview.md` step 2.

## Layout — Mobile + Desktop (single focused column)

```
┌──────────────────────────────────────────────┐
│ Q 3 / 5            ⏱ 02:14   total 11:48      │  ← header: index, per-Q countdown, total
│ ────────────────────────────────────────────  │  (countdown turns red ≤30s; "＋00:42 over" when negative)
│                                                │
│  [System design]                               │  ← type chip
│  Design a rate limiter for a public API.       │  ← prompt (Markdown)
│  …                                             │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ AnswerInput (text / Monaco / MCQ radios)  │ │  ← reused, mode by type
│  └──────────────────────────────────────────┘ │
│                                                │
│  [ Skip ]                 [ Submit & next → ]  │
│                                                │
│  ─────────────  [ End mock ]  ───────────────  │  ← subtle, opens confirm modal
└──────────────────────────────────────────────┘
```

**Composition choice:** deliberately a narrow single reading column (max-w) centered for interview focus — here the centered-column IS the right call (one task, no distractions), not a default reach.

## Components
| Component | Source | New? |
|---|---|---|
| RunHeader (index + dual timer) | feature-local | YES |
| TypeChip | feature-local | small |
| Markdown (prompt) | existing | no |
| AnswerInput | existing | no |
| Skip / Submit buttons | existing | no |
| EndMockConfirm (modal) | feature-local | YES |

## States
| State | Trigger | UI |
|---|---|---|
| loading | between questions | skeleton of prompt + input |
| answering | question ready | as drawn |
| over-time | per-Q countdown < 0 | timer shows "＋MM:SS over", aria-live polite; no force submit |
| submitting | Submit clicked | buttons disabled briefly |
| aborting | End mock | confirm modal (Cancel / End) |

## Interactions
- Submit advances + records {answer, timeTakenSec, overTime}. Skip advances with no answer.
- Keyboard: Ctrl/Cmd+Enter = Submit; no number-key ratings here (rating happens in review).
- `beforeunload` warns (run is ephemeral, lost on reload).
- NO reveal control on this screen.

## Data Needs
Run state is client-only (built from `/api/mock/start`). No per-question fetch.

## Out of Scope
Pause/resume, persistent run.
