---
depends-on: [002]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

A `scripts/coverage-report.ts` (wired as an npm script) that prints, per topic: whether knowledge notes exist, question count per supported type vs target, and the percentage of questions that have a non-empty checklist (`rubric`). This is the always-on progress gauge that drives the continuous checklist retrofit (008) and the §A authoring loop.

Source can be the content tree and/or the DB; reuse the checklist parsing/rubric semantics from 002.

## Acceptance criteria

- [ ] Running the script lists every taxonomy topic with: notes ✓/✗, per-type counts vs target, % questions with a checklist.
- [ ] Output makes it obvious which topics are below target or missing checklists (a "red list").
- [ ] Numbers reconcile with `db:import` counts and `prisma studio`.
- [ ] Runs offline, no external calls.

## Blocked by

- Blocked by `issues/002-checklist-core.md`

## User stories addressed

- User story 25
