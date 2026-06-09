---
depends-on: [002, 004]
type: AFK-content
---

## Parent PRD

`issues/prd.md` (see §A two-lens method; NOT a launch gate)

## What to build

Continuous content work: add a `**Checklist**` block (the Lens-1 senior-answer rubric) to each of the ~859 existing questions, and enrich any file thin under the two anchor lenses. Done in batches **by tier**, driven by the coverage report (004). This is ongoing and explicitly **not** a launch blocker — the engine ships with graceful degrade (003).

Per batch: pick the next red tier from the coverage report → add checklists / enrich → `npm run db:import` → re-run coverage report → mark progress.

## Acceptance criteria (per batch; repeat until all green)

- [ ] Every question in the batch tier has a non-empty, parser-valid `**Checklist**` block.
- [ ] Checklists are written as "what a strong senior answer must hit" (Lens 1), not restating the answer.
- [ ] `db:import` re-parses the batch cleanly; coverage report shows the tier's checklist % at 100%.
- [ ] Knowledge/question files in the batch pass both lenses (enrich where thin).

## Blocked by

- Blocked by `issues/002-checklist-core.md`
- Blocked by `issues/004-coverage-report.md`

## User stories addressed

- User story 7
