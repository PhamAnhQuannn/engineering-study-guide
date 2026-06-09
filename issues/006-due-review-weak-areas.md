---
depends-on: [001]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Two "what should I do next" signals, both reusing `getProgressSummary` (`lib/progress.ts`):

- A **due-driven review entry** that surfaces topics whose `TopicProgress.nextDue <= now` first, so spaced repetition tells the learner what to review today.
- **Weak-area surfacing** on `app/progress`: highlight weak (low avg) and overdue topics.

Independent of the checklist work; can run in parallel with 002–005.

## Acceptance criteria

- [ ] A review entry lists past-due topics first (ordered by how overdue), then the rest.
- [ ] `app/progress` visually flags weak (low-avg) and overdue topics.
- [ ] Uses existing `getProgressSummary`; no schema changes.
- [ ] Verified via `npm run build && npm run start`.

## Blocked by

- Blocked by `issues/001-verify-db-populated.md`

## User stories addressed

- User story 26
- User story 27
