---
depends-on: [002]
type: AFK-to-write / HITL-to-use
---

## Parent PRD

`issues/prd.md` (see §C Mode B)

## What to build

A `/mock-interview` Claude Code skill (a skill file, not app code) — the "live AI interviewer" that needs no API key because it runs in the IDE. The skill:

- Reads the question bank (DB and/or docs), picks questions, asks one at a time in chat, waits for the user's typed answer.
- Grades the answer live against the question's checklist (`rubric`) + `gradeGuidance` from `lib/questionTypes.ts`: score + targeted feedback.
- Asks adaptive follow-ups, drilling deeper where the answer is weak.
- Ends with a transcript + scorecard, and can optionally update content mid/post-session (add/sharpen questions or checklists, fix weak notes) → write to `docs/` → `db:import`.

Honors the hard boundary: this is dev/session-time intelligence (Claude Code), never a runtime app dependency.

## Acceptance criteria

- [ ] `/mock-interview` runs a multi-question session from the bank, one question at a time.
- [ ] Grades each typed answer against the checklist + gradeGuidance with a score and specific feedback.
- [ ] Asks at least one adaptive follow-up when an answer is weak.
- [ ] Produces an end-of-session transcript + scorecard.
- [ ] Can write content improvements back to `docs/` such that `db:import` re-parses them cleanly.

## Blocked by

- Blocked by `issues/002-checklist-core.md`

## User stories addressed

- User story 21
- User story 22
- User story 23
- User story 24
