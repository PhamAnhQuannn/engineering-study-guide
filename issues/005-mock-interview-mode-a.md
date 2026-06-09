---
depends-on: [002, 003]
type: AFK
---

## Parent PRD

`issues/prd.md` (see §C Mode A)

## What to build

The in-app, offline mock interview — a session layer over the existing bank. End-to-end vertical slice:

- `lib/mock.ts` (pure, tested): defines templates (`Quick 5`, `Senior Backend Loop` = KNOWLEDGE×2→CODING→SYSTEM_DESIGN→BEHAVIORAL, `Custom`); expands a template/config into an ordered selection spec; aggregates a finished run into a scorecard (overall, per-type, per-topic, weak areas, over-time flags).
- `app/api/mock/start`: takes a template/config, returns an ordered question set, reusing the unseen-preference selection from `app/api/generate`.
- `app/mock/page.tsx`: drives the timed sequence — one question at a time, **soft timer** (per-question countdown + total, logs time, no force-submit), skip allowed, **no reveal until the end** → review phase reusing `RevealPanel` + `ChecklistGrade` → scorecard.
- MCQ/QUIZ auto-graded 100/0; all other types checklist self-graded.
- Each answered question writes an `Attempt` via the existing `app/api/answer` (SR + progress update). Run is **ephemeral** — no new tables.

## Acceptance criteria

- [ ] Can start a mock from `Quick 5`, `Senior Backend Loop`, or a custom config (tiers/types/count/time).
- [ ] Questions appear one at a time with a visible per-question + total countdown that logs time but never force-submits.
- [ ] No model answer is shown until the session ends; questions can be skipped.
- [ ] Review phase shows each question's answer + checklist; MCQ auto-scored, other types self-graded.
- [ ] Scorecard shows overall + per-type + per-topic + weak areas + over-time flags.
- [ ] Each answered question writes an `Attempt` and advances SR (verify in `prisma studio`).
- [ ] `lib/mock.ts` has unit tests for template expansion and scorecard aggregation (PRD §Testing).

## Blocked by

- Blocked by `issues/002-checklist-core.md`
- Blocked by `issues/003-checklist-ui-rating.md`

## User stories addressed

- User stories 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
