---
depends-on: []
type: AFK
---

## Parent PRD

`issues/prd.md` (supporting refactor; from the 2026-06-08 structure audit in `docs/PLAN.md` / plan file)

## What to build

Low-risk dedup + safety cleanups on the existing codebase. Structure is broadly healthy (audit verdict: additive work is safe) — this is targeted, not a reorg. Do the two P1 items before the coverage-report script (004) and progress work (006), since those build on the deduped surfaces.

- **P1 — single Prisma factory.** The Prisma + better-sqlite3 adapter init is duplicated in `lib/db.ts`, `prisma/seed.ts`, and `scripts/import-docs.ts`. Extract one creation function and reuse in all three.
- **P1 — defensive `parseChoices`.** `app/api/generate/route.ts` does `JSON.parse(q.choices) as string[]` unguarded. Extract a defensive helper (mirror `lib/rubric.ts`'s `parseRubric`) returning `string[] | null`.
- **P2 — shared `scoreColor` + `Stat`.** Both are duplicated across `app/page.tsx` and `app/progress/page.tsx`. Extract to a shared module.
- **P3 — SR constants + tests + doc.** Name the SR intervals (8h/3d/14d) as constants in `lib/spacedRepetition.ts`; add unit tests for `spacedRepetition` and `progress`; comment the always-empty `Attempt.userAnswer`.

**Do NOT** remove the "unused" exports `QUESTION_TYPE_LIST` / `DIFFICULTIES` — likely needed by the mock type-picker (issue 005). Verify usage first.

## Acceptance criteria

- [ ] One Prisma-init function used by `lib/db.ts`, `prisma/seed.ts`, `scripts/import-docs.ts`; `db:import` / `db:seed` still work.
- [ ] `parseChoices` helper handles valid/null/malformed input (returns `string[] | null`); `api/generate` uses it; unit-tested.
- [ ] `scoreColor` + `Stat` live in one shared module; both pages import it; no visual change.
- [ ] SR intervals are named constants; `spacedRepetition` + `progress` have unit tests; all tests green.
- [ ] `npm run build` passes; `npm test` green.

## Blocked by

None - can start immediately. (Recommended before `issues/004-coverage-report.md` and `issues/006-due-review-weak-areas.md`.)

## User stories addressed

- Supporting refactor (no direct PRD story; enables 28/29 reliability and eases 004/006).
