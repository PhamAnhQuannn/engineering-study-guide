---
depends-on: []
type: AFK + design-review
---

## Parent PRD

`issues/prd.md` (UI/UX design for the net-new surfaces)

## What to build

A **light** UI/UX design pass (docs only, no app code) for the genuinely new/complex surfaces, so 003/005/006 are built against a thought-through flow + a11y spec instead of ad-hoc. Reuses the existing visual style (audit found it consistent) — no design-system/mood-board rework.

Run these skills, writing to `docs/design/`:
- `/user-flow` — mock interview flow (setup → timed run → review → scorecard) + the checklist reveal→grade flow, as sequence/state diagrams.
- `/ui-wireframe` — screens: mock setup, timed run (timer + answer), review phase, scorecard; plus the `ChecklistGrade` component and the progress page additions (due + weak-area).
- `/a11y-design` — timer announcements (aria-live), keyboard ratings (1/2/3 = Again/Good/Easy), checklist tick focus order, reduced-motion, no color-only signals.
- Optional: `/design-review` after, to cross-check the artifacts.

## Acceptance criteria

- [ ] `docs/design/flows/` has the mock interview flow + checklist grade flow.
- [ ] `docs/design/wireframes/` covers mock setup/run/review/scorecard, ChecklistGrade, and progress additions, each with loading/empty/error/over-time states.
- [ ] `docs/design/a11y-*.md` covers keyboard map, focus order, aria-live for the timer, reduced-motion, contrast.
- [ ] Wireframes reuse existing components/patterns where possible (RevealPanel, AnswerInput, Stat).
- [ ] 003/005/006 reference these artifacts when implemented.

## Blocked by

None - can start immediately. (Recommended to precede `issues/003`, `issues/005`, `issues/006`.)

## User stories addressed

- Design support for stories 1–20, 26, 27
