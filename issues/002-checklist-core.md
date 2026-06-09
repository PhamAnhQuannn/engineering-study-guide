---
depends-on: [001]
type: AFK
flags: [high-fan-in]
---

## Parent PRD

`issues/prd.md`

## What to build

The shared, pure foundation for checklists (the deep module other slices target). Three pieces, no UI:

1. Extend the deterministic markdown parser (`lib/docsParse.ts`) to capture a trailing `**Checklist**` block (a list of `- [ ]` bullets) per question, terminated by the next question heading or end of file.
2. A new pure helper (`lib/rubric.ts`): (de)serialize a rubric (JSON list of strings ↔ array), compute coverage % from ticked vs total, and map coverage % → suggested rating using fixed thresholds (<40% Again, 40–80% Good, >80% Easy).
3. Make the import (`scripts/import-docs.ts`) store the parsed checklist as JSON in the existing `Question.rubric` column (replace the hardcoded `"[]"`).

No schema migration (the `rubric` column already exists). See PRD §Implementation Decisions and §6 of `docs/PLAN.md` for the exact markdown contract.

## Acceptance criteria

- [ ] Parser returns the checklist items for a question that has a `**Checklist**` block; returns empty for one that doesn't.
- [ ] Parser handles mixed `- [ ]` / `- [x]` bullets and a checklist terminated by the next heading.
- [ ] `lib/rubric.ts` coverage math is correct at 0/N, all/N, and partial; threshold→rating correct at and around 40% and 80% boundaries; serialize/deserialize round-trips.
- [ ] `db:import` writes non-empty `rubric` JSON for questions that have a checklist in markdown.
- [ ] Unit tests cover parser checklist extraction and the rubric/coverage helper (the two pure modules per PRD §Testing).

## Blocked by

- Blocked by `issues/001-verify-db-populated.md`

## User stories addressed

- User story 6
- User story 7
