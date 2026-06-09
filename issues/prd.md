# PRD — Interview Prep: Checklist Self-Grading + Mock Interview (MVP)

_Source of truth: this file. Companion design doc: `docs/PLAN.md`. Decisions locked via `/grill-me` 2026-06-08._

## Problem Statement

A learner using the app today can drill questions topic-by-topic and self-rate with Again/Good/Easy, but:

- **Self-grading is subjective.** After revealing the model answer there is nothing that tells the learner *what a strong senior answer actually had to contain*, so the Again/Good/Easy choice is a guess. The `rubric` field exists in the schema but is always empty (`"[]"`), never parsed from content, never shown.
- **There is no interview rehearsal.** Practice is one isolated question at a time (one topic, one type). A real interview is a timed, mixed sequence across question types with an end-of-loop assessment. The app cannot reproduce that pressure or produce a scorecard.
- **There is no "what should I do next" signal.** Nothing surfaces which topics are due for review or where the learner is weak.
- **Content completeness is invisible.** ~60 topics and ~859 questions exist, but there is no report of which topics still lack checklists or are thin, so finishing coverage is guesswork.

The app must stay **offline, single-user, free, no auth, with zero runtime AI** — all generation/grading intelligence comes from Claude Code at dev/session-time, not from a runtime model call.

## Solution

Two product surfaces over the existing question bank, plus the supporting engine:

1. **Checklist self-grading (Lens 1 — interviewer rubric).** Every question can carry a checklist of the key points a strong senior answer must hit. On reveal, the learner ticks the points they covered; coverage % auto-suggests the spaced-repetition rating (overridable). Questions without a checklist degrade gracefully to the current answer + manual rating.

2. **Mock Interview (Mode A, in-app).** A timed, multi-question, multi-type session built from a template (`Quick 5`, `Senior Backend Loop`) or a custom builder, answered with no reveal until the end, then reviewed question-by-question with checklists, producing a scorecard (overall / per-type / per-topic / weak areas / over-time flags). Each answered question feeds spaced repetition.

3. **Mock Interview (Mode B, Claude Code skill).** A `/mock-interview` skill where Claude Code acts as a live adaptive interviewer and grader against each question's checklist + grading guidance, asks follow-ups, and can update content mid-session. This is the "live AI" path that needs no API key because it runs in the IDE.

4. **Supporting engine.** A coverage-report script, a due-driven review entry, and weak-area surfacing on the progress page.

Content authoring (adding checklists to the existing 859 questions, enriching thin files) is a **continuous post-launch activity**, not a launch gate.

## User Stories

### Checklist self-grading
1. As a learner, after I reveal a model answer, I want to see a checklist of the key points a strong senior answer must include, so that I can grade myself against an objective bar instead of a vibe.
2. As a learner, I want to tick each checklist point I actually covered, so that my self-assessment reflects what I knew.
3. As a learner, I want my checklist coverage to suggest an Again/Good/Easy rating automatically, so that I don't have to guess the rating.
4. As a learner, I want to override the suggested rating, so that I stay in control when the auto-suggestion feels wrong.
5. As a learner, when a question has no checklist yet, I want to still see the model answer and rate manually, so that missing checklists never block practice.
6. As a learner, I want my coverage % recorded with the attempt, so that the system can later show where I am weak.
7. As an author (Claude Code), I want to write a checklist per question in markdown and have it imported into the question bank, so that the runtime can display it.

### Mock interview — Mode A (in-app)
8. As a learner, I want to start a mock interview from a preset template, so that I can rehearse a realistic loop without configuring anything.
9. As a learner, I want a `Quick 5` template, so that I can do a fast ~15-minute mixed warmup.
10. As a learner, I want a `Senior Backend Loop` template (a knowledge warmup, a coding problem, a system-design question, and a behavioral question), so that I can rehearse a realistic full interview.
11. As a learner, I want a custom builder where I pick tiers, question types, count, and time per question, so that I can target a specific interview shape.
12. As a learner, I want each question shown one at a time with a visible per-question countdown and a total timer, so that I feel interview time pressure.
13. As a learner, I want the timer to be informational (it logs my time but does not force-submit), so that I can finish thinking without being cut off.
14. As a learner, I want to answer (or skip) without seeing the model answer until the whole session is done, so that the mock mirrors a real interview.
15. As a learner, I want a review phase at the end that walks each question with its model answer and checklist, so that I can grade my performance.
16. As a learner, I want multiple-choice questions auto-graded, so that part of my score is objective.
17. As a learner, I want a scorecard with an overall result plus per-type and per-topic breakdowns and flagged weak areas, so that I know what to study next.
18. As a learner, I want questions I answered in a mock to count toward my spaced-repetition progress, so that a mock doubles as real practice.
19. As a learner, I want the mock to prefer questions I have not seen before, so that rehearsals stay fresh.
20. As a learner, I want over-time questions flagged on the scorecard, so that I learn where I am too slow.

### Mock interview — Mode B (Claude Code skill)
21. As a learner, I want to run a live mock interview through Claude Code, so that I get an adaptive interviewer without any API key or paid service.
22. As a learner, I want Claude Code to grade my typed answer against the question's checklist and grading guidance, so that I get specific feedback, not just a model answer.
23. As a learner, I want Claude Code to ask follow-up questions when my answer is weak, so that the rehearsal probes depth like a real interviewer.
24. As a learner, I want Claude Code to optionally improve or add questions/checklists it found weak during the session, so that the content gets better as I practice.

### Coverage, review, and progress
25. As an author, I want a coverage report listing, per topic, whether knowledge exists, question counts per type vs target, and the percentage of questions that have a checklist, so that I can see what is left to finish.
26. As a learner, I want a review entry that surfaces topics whose next-review time has passed first, so that spaced repetition tells me what to do today.
27. As a learner, I want the progress page to highlight my weak and overdue topics, so that I can prioritize.

### Operability
28. As a maintainer, I want to confirm the question bank is actually loaded into the database, so that I am building features on real data.
29. As a maintainer, I want re-importing content to be safe and repeatable, so that adding checklists later does not corrupt or duplicate questions.

## Implementation Decisions

### Modules to build or modify
- **Checklist parsing (deep module).** Extend the deterministic markdown parser so that, for each question, it captures a trailing checklist block (a `**Checklist**` marker followed by `- [ ]` bullets) into a list of strings, alongside the existing prompt/answer extraction. Pure function over text → structured questions; no I/O; isolated and testable.
- **Checklist import.** The import step stores the parsed checklist as a JSON string in the existing `Question.rubric` column, replacing the hardcoded empty value. Re-import remains idempotent and preserves attempted questions (existing behavior).
- **Rubric/coverage helper (deep module).** A pure module that: serializes/deserializes a rubric; computes coverage % from ticked vs total items; and maps coverage % to a suggested rating using fixed thresholds (<40% → Again, 40–80% → Good, >80% → Easy). No React, no DB; isolated and testable.
- **Question fetch API.** The single-question endpoint additionally returns the question's rubric so the client can render the checklist.
- **Checklist UI component.** A new component renders the rubric as tickable items, shows live coverage %, and surfaces the suggested (overridable) rating. Integrated into the existing reveal panel. When the rubric is empty, the panel renders today's behavior (answer + manual rating) unchanged.
- **Answer recording.** When a rating is recorded, the coverage % (and, for mocks, time taken / over-time) is written into the attempt's existing `feedback` JSON. No schema migration.
- **Mock session logic (deep module).** A pure module defining the templates (`Quick 5`, `Senior Backend Loop`, `Custom`), expanding a template/config into an ordered selection spec, and aggregating a finished run into a scorecard (overall, per-type, per-topic, weak areas, over-time flags). No I/O; isolated and testable.
- **Mock start API.** An endpoint that takes a template/config and returns an ordered set of questions, reusing the existing unseen-preference selection logic.
- **Mock run page.** A client page that drives the timed sequence (one question at a time, soft countdown + total, log time, skip allowed, no reveal until the end), then runs the review phase reusing the reveal + checklist components, then shows the scorecard. MCQ/QUIZ auto-graded 100/0; all other types checklist-self-graded. Each answered question writes an attempt via the existing answer endpoint. The run itself is ephemeral client state — no new tables.
- **Coverage report script.** A script that walks the content tree (or the DB) and prints per-topic: knowledge present?, question count per type vs target, and % of questions with a non-empty checklist.
- **Due-driven review entry + weak-area surfacing.** A review entry that orders topics by past-due next-review time first, and additions to the progress page that highlight weak/overdue topics, reusing the existing progress summary.
- **`/mock-interview` Claude Code skill (Mode B).** A skill (not app code) that reads the bank, conducts a live graded interview against checklist + grading guidance, asks adaptive follow-ups, and can write content updates back to the docs tree for re-import.

### Architectural decisions
- **No runtime AI, ever.** No model/API calls from any route. All generation and grading intelligence is Claude Code at dev/session-time. Auto-suggested ratings and MCQ grading are deterministic.
- **Graceful degradation.** Empty rubric ⇒ current answer + manual-rating experience. The checklist feature can ship before content is fully retrofitted.
- **Reuse over rebuild.** Mocks reuse the existing question selection, answer/rating recording, spaced-repetition update, reveal UI, and progress summary. Mock adds only a session/scorecard layer on top.
- **Ephemeral mock runs.** Only per-question attempts persist (so spaced repetition and progress update); the run/scorecard is computed in memory. Persistent mock history is explicitly deferred.
- **Width stays senior-backend for v1.** No new tiers/topics in this PRD. Broadening to general SWE (coding patterns, frontend) is later work.

### Schema / data contracts
- **No migration required.** `Question.rubric` already exists (stores JSON list of checklist strings). `Attempt.feedback` already exists (stores JSON; gains `coverage`, and for mocks `timeTakenSec` / `overTime`).
- **Checklist markdown contract:** each question's answer may be followed by a `**Checklist**` marker and a list of `- [ ]` bullets, terminated by the next question heading or end of file.
- **Mock start contract:** input = template id or custom config (tiers, types, count, time-per-question); output = ordered list of questions (id, prompt, type, choices, topic) with unseen preferred.

### Pre-task (before building)
- Verify the database is actually populated from the content tree (run the import and inspect counts / DB), since "docs filled" does not guarantee "DB served".
- Per `AGENTS.md`, read the bundled Next.js docs before modifying any route — this Next major has breaking changes.

## Testing Decisions

A good test asserts **external, observable behavior** through a module's public interface, not its internals. Tests should survive refactors of the implementation.

- **Checklist parsing** — unit tests over representative markdown: a question with a checklist, a question without one, a checklist with mixed `- [ ]` / `- [x]` bullets, a checklist terminated by the next question heading, and a malformed/absent marker. Assert the extracted prompt, answer, and checklist list. Prior art: the existing deterministic parsing of questions/answers from category markdown.
- **Rubric/coverage helper** — unit tests for coverage % math (0 of N, all of N, partial) and threshold→rating mapping at and around the 40% / 80% boundaries; round-trip serialize/deserialize.
- **Mock session logic** — unit tests that a template expands to the correct ordered type sequence and counts; that a custom config is respected; and that a finished run aggregates into the correct overall/per-type/per-topic scorecard, weak areas, and over-time flags (including MCQ auto-grade vs checklist self-grade).
- **Not prioritized for automated tests:** React page/component rendering, API route wiring, and the Claude Code skill (these are integration/manual surfaces). Confirm with the developer if component tests for the checklist UI are wanted.

Modules explicitly proposed for tests: **checklist parsing**, **rubric/coverage helper**, **mock session logic** (the three pure, deep modules).

## Out of Scope
- Any runtime AI / model API / BYO-key in the web app.
- Accounts, auth, multi-user, cloud sync, hosting, payments.
- Persistent mock history tables (`MockSession`/`MockItem`) and a past-mocks browse view.
- Mock Mode C (app→Claude Code transcript export + `/grade-mock` bridge).
- Width expansion: coding-patterns topic, frontend/web tier, persona softening.
- In-app question authoring/editing (authoring stays in the markdown + Claude Code pipeline).
- Completing checklists for all 859 questions — this is continuous post-launch content work, tracked by the coverage report, not a launch gate.

## Further Notes
- Anchor questions that drive all content (the checklist source and review gate): **Lens 1 (interviewer)** — "If I interview a senior software engineer, what should I ask him?"; **Lens 2 (learner)** — "As a new grad who wants to pass a senior SWE interview, how do I prepare and master this with knowledge + practice?"
- Suggested build order: (0) verify DB populated → (1) checklist engine end-to-end → (2) coverage report → (3) mock Mode A → (4) due-entry + weak-area surfacing → (5) `/mock-interview` skill. Content checklist retrofit runs continuously alongside.
- Verification target: `npm run db:import` shows non-empty rubric counts for a sample topic; `npm run build && npm run start` → practice reveal shows checklist, ticking suggests a rating, rating persists and advances spaced repetition; a mock run completes and produces a scorecard.
