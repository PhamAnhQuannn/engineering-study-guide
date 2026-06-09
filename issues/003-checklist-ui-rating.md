---
depends-on: [002]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

The end-to-end checklist self-grading experience on top of the core (002). Vertical slice through API → UI → rating → persistence:

- `app/api/generate` returns the question's `rubric` (parsed checklist) alongside the existing fields.
- New `components/ChecklistGrade.tsx` renders the rubric as tickable items with live coverage %, integrated into `RevealPanel`.
- Coverage % auto-suggests the Again/Good/Easy rating (via `lib/rubric.ts`), pre-selected but **overridable** by the user.
- The chosen rating records as today (`app/api/answer`) and additionally stores the coverage % in the `Attempt.feedback` JSON.
- **Graceful degrade:** a question with an empty rubric renders the current behavior unchanged (model answer + manual rating).

## Acceptance criteria

- [ ] Revealing a question that has a checklist shows tickable items + live coverage %.
- [ ] Ticking items updates the suggested rating per the thresholds; user can override before submitting.
- [ ] Submitting persists the rating (SR advances) and writes coverage % into `Attempt.feedback`.
- [ ] A question with no checklist shows answer + manual rating exactly as before (no regression).
- [ ] Verified end-to-end via `npm run build && npm run start` (dev 500s on this box).

## Blocked by

- Blocked by `issues/002-checklist-core.md`

## User stories addressed

- User story 1
- User story 2
- User story 3
- User story 4
- User story 5
- User story 6
