---
depends-on: []
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Establish ground truth before any feature work: confirm the authored content tree actually imports into the SQLite DB and is reachable by the runtime. Run the import, inspect counts, and fix the import path if anything is missing. This is the PRD **Pre-task**.

Per `AGENTS.md`, read `node_modules/next/dist/docs/` before touching any route (Next 16 has breaking changes) — relevant for later slices, noted here as the project-wide guardrail.

## Acceptance criteria

- [ ] `npm run db:import` runs clean and prints per-type counts.
- [ ] DB contains ~859 questions and ~60 study notes (verify in `prisma studio` / `db:studio`).
- [ ] Each of the 60 taxonomy topics has questions for its supported types (no topic silently empty).
- [ ] Re-running `db:import` is idempotent (no duplicates; attempted questions preserved) — confirms PRD story 29.
- [ ] Any discrepancy between docs content and DB rows is documented or fixed.

## Blocked by

None - can start immediately.

## User stories addressed

- User story 28
- User story 29
