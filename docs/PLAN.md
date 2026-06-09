# Interview Prep — Detailed Build & Coverage Plan

## Table of Contents
1. Vision & Goal
2. How the System Works
3. Ground Truth (what exists today)
4. Coverage Model (width + depth)
5. Topic Initialization Workflow (knowledge → questions → practice)
6. Per-Topic Markdown Format Spec (parser-exact)
7. Claude Code Authoring Workflow (no API key)
8. Engine Gaps to Close (checklist, coverage report, due session)
9. Growth Plan — Phases & Milestones
10. What an Authoring Session Looks Like
11. Folder Structure
12. Scope (in/out)
13. Open Decision
14. Verification

---

## 0. Coverage Audit — Actual State (scanned 2026-06-08)
Direct scan of `docs/` shows **content is essentially complete.**
- **0 `<!-- TODO:fill -->` placeholders** in real content.
- **All 60 taxonomy topics have a filled `01-knowledge/README.md`**.
- **~859 questions**, parser-valid. Per category, all meet/exceed targets: practice 605, real-situations 172, behavioral 62, coding 52, decision 49, design 43, estimation 39.
- **The ONE real gap: `**Checklist` blocks = 0 everywhere** — `rubric` empty end-to-end (content + parser + import + UI).
- Caveat: docs filled ≠ DB populated; verify with `db:import` counts / `prisma studio`.

## A. Content Completion Pass — Two-Lens Method (ACTIVE TASK)
Finish coverage by running **every file** through two standing anchor questions — the authoring brief, the review gate, and the checklist source — applied file by file until all pass.

**Lens 1 — Interviewer:** *"If I interview a senior software engineer, what should I ask him?"* → every question at senior bar (depth, tradeoffs, failure modes, why/when — not trivia); add missing must-ask Qs. Each question's `**Checklist`** = what a strong senior answer must hit.

**Lens 2 — Learner:** *"As a new grad who wants to pass a senior SWE interview, how do I prepare and master this with knowledge + practice?"* → `01-knowledge` notes teach to mastery (learnable cold); question set deep enough to drill.

### Per-file Definition of Done
- `01-knowledge/README.md`: teaches to mastery (L2) **and** covers what an interviewer probes (L1).
- each question file: every Q ask-worthy at senior bar (L1) **and** set deep enough to practice (L2); add missing high-value Qs.
- **every question carries a `**Checklist`** block** (the L1 senior-answer rubric) — main retrofit across ~859 questions.
- still parses (§6) and re-imports.

### The loop (repeat for every file)
Tier → topic → file: read → apply both lenses → enrich knowledge / add-sharpen questions / add checklist to every Q → `db:import` → coverage report → mark done in `docs/COVERAGE.md` ledger → next. Repeat until all files pass both lenses + have checklists. Both anchor questions baked into the `author-topic` skill (§7).

## B. Using the Content on the Website — Two Lenses → Two Surfaces
Same content (knowledge + questions + checklists) powers two surfaces:
- **Learner surface (Lens 2) — "Prep & Master":** study → practice by type → checklist self-grade → SR review → progress/weak-areas. Mostly built. Adds: checklist self-grade, recommended **prep path**, weak-area surfacing.
- **Interviewer surface (Lens 1) — "Mock Interview":** site plays interviewer — mixed timed set → self-grade vs checklists → scorecard. New (§C).
- **Checklists = connective tissue:** each question's `**Checklist`** = senior-answer rubric → self-grade + suggested rating in both practice and mock.

## C. Mock Interview — Plan
A mock = a **session layer** over the bank. Today `app/practice` runs ONE question (one topic+type) via `/api/generate` → reveal → `/api/answer`; no session/timer/scorecard. Three modes:

### Mode A — In-app offline mock (no AI; default feature)
- A mock = a **session template** (e.g. *Senior Backend Loop*: KNOWLEDGE×2 → CODING×1 → SYSTEM_DESIGN×1 → BEHAVIORAL×1, time-boxed) or a **custom** builder (tiers/types/#Q/time).
- **Flow:** build ordered set (`app/api/mock/start`, reuse unseen-pref from `api/generate`) → per Q: timer + `AnswerInput`, **no reveal until submit/skip** → review phase reveals answer + checklist (`RevealPanel` + new `ChecklistGrade`), tick covered → per-Q self-score → **scorecard** (overall/per-type/per-topic) + weak areas → write `Attempt` per Q (reuse `api/answer`) + advance SR.
- Persistence: minimal first = ephemeral run + `Attempt`s; later `MockSession`/`MockItem` for history. Deterministic, offline.

### Mode B — Claude-Code LIVE mock (the "on live" path; no API key)
Runtime has no AI; the live interviewer is **Claude Code in the IDE** — skill `/mock-interview`: picks questions, asks one at a time, **grades live** vs checklist+`gradeGuidance`, asks **adaptive follow-ups**, ends with transcript + scorecard, and can **update content mid-session** (add Qs/checklists, fix notes) → `db:import`.

### Mode C — Hybrid bridge (app ↔ Claude Code)
App **exports** a mock transcript (Qs + typed answers) → load into Claude Code → `/grade-mock` skill grades vs checklists, returns feedback + suggested new Qs → optionally writes back. AI grading, no runtime key.

**Hard boundary:** website = 100% offline/no-AI. All intelligence (authoring, live interview, grading) = Claude Code at dev/session-time. No runtime model dependency.

## 1. Vision & Goal
A free, **offline**, single-user website to prepare for **software-engineer** interviews. Broad curriculum, every topic covered to a consistent standard (study notes + typed questions + model answers + self-grading checklists), drilled with spaced repetition. The "AI" that writes content is **Claude Code at dev-time** — no API key needed at runtime.

Success = every taxonomy topic meets the **Definition of Covered** (§4), verified by a coverage report; width matches the chosen audience.

## 2. How the System Works
Two planes, cleanly separated:

```
 DEV-TIME (Claude Code = the author)          RUNTIME (offline app, no AI)
 lib/taxonomy.ts                               SQLite dev.db
   │ npm run db:scaffold                         ▲  reads        │ writes
   ▼                                             │               ▼
 docs/<tier>/<topic>/<cat>/README.md   ── db:import ──►  Question / StudyNote rows
   ▲ Claude Code fills:                                  /api/generate  /api/answer
     notes + Q + answer + checklist                            │
                                                               ▼
                                              practice · study · progress UI
                                              self-rate (again/good/easy) → SR nextDue
```

- **Authoring plane:** taxonomy defines the spine → `db:scaffold` writes an empty docs tree (`<!-- TODO:fill -->`) + `.manifest.json` → Claude Code fills markdown → `db:import` deterministically parses markdown into DB rows. Content is version-controlled, diffable, re-importable.
- **Runtime plane:** dumb + offline. `/api/generate` picks a question (prefers unseen) from the DB; user answers in a text/code/MCQ widget; reveals model answer (+ checklist); self-rates; `/api/answer` records an `Attempt` and advances spaced repetition (`TopicProgress.nextDue`). No model calls, ever.

## 3. Ground Truth (exists today)
- **Stack:** Next.js 16.2.7 / React 19 / TS strict / Tailwind 4. ⚠️ `AGENTS.md`: this Next has breaking changes — read `node_modules/next/dist/docs/` before touching routes.
- **DB:** Prisma 7 + better-sqlite3 → `dev.db`. Models: `Topic`, `Question`(prompt, choices, referenceAnswer, **rubric**, type, difficulty, source, seen), `Attempt`, `TopicProgress`(nextDue), `StudyNote`.
- **SR:** `lib/spacedRepetition.ts` — again/good/easy → score 20/70/95, nextDue 8h/3d/14d, running avg.
- **Types:** `lib/questionTypes.ts` — 10 types w/ genGuidance + gradeGuidance. **Taxonomy:** `lib/taxonomy.ts` — 12 tiers, ~60 topics (backend-tilted).
- **Pipeline:** `scripts/scaffold-docs.ts`, `lib/docsParse.ts`, `scripts/import-docs.ts`, `prisma/seed.ts`. Scripts: `db:scaffold | db:import | db:seed | db:studio`.
- **Runtime:** `app/practice`, `app/topic/[slug]`, `app/topic/[slug]/study`, `app/progress`; `api/generate`, `api/answer`, `api/progress`. Components: `AnswerInput`, `RevealPanel`, `Markdown`, `TopicStarter`.
- **Gaps:** `rubric` always `"[]"` (no parse, no UI); no coverage report; no due-driven session entry; persona hardcoded "senior backend".

## 4. Coverage Model
Two axes: **width** (curriculum span) and **depth/clarity** (per-topic standard).

### 4a. Width — breadth + gaps
Current = 12 tiers / ~60 topics, **senior-backend tilted**. For general SWE:
- **Add Coding Patterns** topic in T1 — two-pointer, sliding window, BFS/DFS, DP, backtracking, heaps/intervals (the LeetCode spine).
- **Add Frontend / Web tier (T13)** — HTML/CSS, JS/TS deep, framework (React), browser rendering/DOM, state management, web performance, accessibility, frontend system design.
- **Soften persona** in `questionTypes.ts` genGuidance from "senior backend engineer" → role-aware wording so frontend/general items read right.
- Backend-only alternative: skip T13 + Coding Patterns expansion, keep persona. (See §13 — the one open decision.)

### 4b. Depth — Definition of Covered (per topic)
A topic is **Covered** when:
1. **Study notes** (`01-knowledge/README.md`): structured — *concept → why it matters → key mechanisms → tradeoffs → when to use → common pitfalls*. No `<!-- TODO:fill -->`.
2. **Question sets** for **each** of the topic's `supportedTypes`, at target counts:
   - intro: ≥3 per type · core: ≥5 per type · advanced: ≥5 per type incl. hard items.
3. **Every question:** clear prompt · correct **model answer** · **checklist/rubric** (key points a strong answer must hit) · difficulty tag.
4. **Difficulty mix** matches the topic's declared difficulty.
5. **Machine-checkable:** re-parses via `docsParse.ts`; import report shows non-zero count per supported type **and** non-empty `rubric`.

### 4c. Coverage tracking
`scripts/coverage-report.ts` (or extend the import log) prints per topic: notes ✓/✗, questions-per-type vs target, % questions with non-empty rubric → drives loop-until-green authoring. Optionally surface per-topic coverage on `app/progress`.

## 5. Topic Initialization Workflow — bringing ONE topic to "Covered"
The repeatable unit of work. For topic `<slug>`:

1. **Knowledge first.** Claude Code writes `01-knowledge/README.md` study notes using the §4b structure. This is the source material the questions draw from.
2. **Questions per category.** For each scaffolded practice category the topic supports (practice-questions, coding-problems, design-questions, estimation-questions, decision-questions, real-situations, behavioral-questions), Claude Code authors questions to target counts — each with prompt, model answer, and checklist — in the parser-exact format (§6). genGuidance/gradeGuidance per type is the brief.
3. **Import.** `npm run db:import` parses markdown → upserts `Question`/`StudyNote`. Safe re-run (un-attempted docs questions cleared first).
4. **Verify.** Coverage report green for the topic; spot-check in `prisma studio` that `rubric` rows are non-empty; reveal in app shows checklist.
5. **Loop.** Next topic. Thin/empty topics get a re-author pass.

Order of topics = interview priority: Coding Patterns + DS/Algos + Complexity → System Design + Databases + Distributed → Networking/Security/Infra → Behavioral/Situations → Frontend (if broadened) → long tail.

## 6. Per-Topic Markdown Format Spec (parser-exact)
`lib/docsParse.ts` is deterministic — headings + bold markers must match exactly. Per category:

| Category folder | Question heading | Answer marker | Parsed type |
|---|---|---|---|
| `practice-questions` | `## Q1` / `### Q1` (add `(mcq)` for MCQ) | line starting `**Answer` | KNOWLEDGE (or QUIZ if ≥2 `A.`/`B.` options) |
| `coding-problems` | `## Problem 1` or `## P1` | `**Approach` | CODING |
| `design-questions` | `## D1` | `**Requirements` | SYSTEM_DESIGN |
| `estimation-questions` | `## E1` | `**Assumptions` | ESTIMATION |
| `decision-questions` | `## DC1` (or `## D1`) | `**Recommendation` | DECISION |
| `real-situations` | `## S1` or `## Situation 1` | `**Mitigate` | SCENARIO |
| `behavioral-questions` | `## B1` | `**What good looks like` | BEHAVIORAL |
| `01-knowledge` | (whole file) | — | StudyNote (not Q&A) |

**Known limitation:** EXPLAIN→tagged KNOWLEDGE, DEBUG→tagged CODING (parser collapses them). Acceptable; note for later if distinct tagging is wanted.

**Checklist block (NEW — to be supported):** after each question's answer, add:
```
**Checklist**
- [ ] key point one
- [ ] key point two
```
Requires: extend `docsParse.ts` to capture the `**Checklist**` bullets per question, and `import-docs.ts` to store them as JSON into `Question.rubric` (replace the hardcoded `"[]"`).

Example `practice-questions/README.md`:
```markdown
# <Topic> — Practice Questions

## Q1. What is a hash collision and how is it resolved?
**Answer:** A collision is when two keys hash to the same bucket... (chaining vs open addressing, load factor, resize).
**Checklist**
- [ ] Defines collision correctly
- [ ] Names >=2 resolution strategies
- [ ] Mentions load factor / resize impact
```

## 7. Claude Code Authoring Workflow (no API key)
Claude Code **is** the generator, at dev-time, committed to markdown. Formalize for consistency:
- **A project skill** `.claude/skills/author-topic/SKILL.md` (`/author-topic <slug>`): reads taxonomy + genGuidance + the topic's knowledge notes, fills each supported category to target counts in §6 format incl. checklist, then self-checks the output re-parses. **Standing brief = the two anchor questions (§A):** every file must pass Lens 1 (interviewer) + Lens 2 (learner); each checklist written as the senior-answer rubric.
- Or lighter: an `AUTHORING.md` spec + ad-hoc prompts.
- **Loop-until-dry:** run author-topic → `db:import` → coverage report → re-author thin topics until green. Width first (taxonomy + scaffold), then depth.
- **`/mock-interview` skill (Mode B, §C):** live adaptive interviewer + grader; can update content mid-session.
- **`/grade-mock` skill (Mode C, §C):** grade an exported app transcript offline + suggest new questions.

## 8. Engine Gaps to Close
Small code work that unlocks the coverage standard + UX:
- **Checklist feature (end-to-end):** parse `**Checklist**` (`docsParse.ts`) → store rubric (`import-docs.ts`) → return rubric in `api/generate` → render `components/ChecklistGrade.tsx` in `RevealPanel` → tick items → coverage % suggests rating → store coverage on `Attempt`. Helper: `lib/rubric.ts`.
- **Coverage report:** `scripts/coverage-report.ts` (§4c).
- **Due-driven session:** entry that pulls topics with `TopicProgress.nextDue <= now` first (A5), so reviews surface what's due.
- **Weak-area surfacing:** rank low-avg / overdue topics on `app/progress` (reuse `getProgressSummary` in `lib/progress.ts`).
- **Mock interview (Mode A, §C):** `app/api/mock/start` (ordered set, reuse unseen-pref), `app/mock/page.tsx` (timed run, reveal at end), review reuses `RevealPanel` + `ChecklistGrade`, `lib/mock.ts` (templates + scorecard), `Attempt`s via `api/answer`; optional `MockSession`/`MockItem` later; transcript export (Mode C).

## 9. Growth Plan — Phases & Milestones
- **Phase 0 — Engine ready (S):** checklist end-to-end + coverage-report script + due-session entry. Outcome: the coverage standard is measurable and self-grading works.
- **Phase 1 — Width locked (S):** finalize taxonomy per §13 (Coding Patterns + Frontend tier if broadening), `db:scaffold`. Outcome: full topic skeleton exists.
- **Phase 2 — Depth authoring: MOSTLY DONE (per §0 audit).** All 60 topics already have knowledge + question sets at/above target. Remaining = **checklist retrofit + two-lens enrichment** across ~859 existing questions (loop file-by-file per §A) + re-import. This, not new Q&A, is the bulk of the content work left.
- **Phase 2.5 — Mock Interview (M):** Mode A in-app mock (templates + timed run + scorecard, §C) on the checklist engine; then `/mock-interview` (B) + `/grade-mock` (C) skills. Turns the bank into the Lens-1 interviewer surface.
- **Phase 3 — Polish (M):** weak-area UI, per-topic coverage on progress, prep-path (Lens-2), session UX, search/filter across the bank.
- **Phase 4 — Maintenance/growth (ongoing):** add topics, refresh content, deepen difficulty, expand to new roles.

"How it grows": each topic is an independent unit; Claude Code adds breadth (new taxonomy entries) and depth (more/harder questions) incrementally; the coverage report is the always-on progress gauge; hot topics first, long tail later.

## 10. What an Authoring Session Looks Like
One repeatable work session (≈ a sprint unit):
1. Pick next N topics by priority from the coverage report's red list.
2. For each: `/author-topic <slug>` → knowledge notes → questions+answers+checklists to target counts.
3. `npm run db:import` → re-run coverage report.
4. Spot-check in app (`build && start`) + `prisma studio`.
5. Commit content. Repeat next session with the new red list.

## 11. Folder Structure (existing + additions +)
```
interview-prep/
  app/ ... practice/ topic/[slug]/ progress/
       + mock/page.tsx                  (timed mock run + scorecard, §C Mode A)
       api/generate  api/answer  api/progress      (generate returns rubric +)
       + api/mock/start/route.ts        (build ordered question set)
  components/ AnswerInput RevealPanel Markdown TopicStarter
              + ChecklistGrade.tsx
  lib/ spacedRepetition questionTypes taxonomy progress db
       docsParse.ts   (+ parse **Checklist**)
       + rubric.ts  + mock.ts   (templates + scorecard aggregation)
  prisma/ schema.prisma (rubric col exists) seed.ts migrations/
       (+ optional later: MockSession / MockItem)
  scripts/ scaffold-docs import-docs (+ store real rubric)
           + coverage-report.ts
  docs/ <tier>/<topic>/<cat>/README.md   (authored KB)
  + .claude/skills/author-topic/SKILL.md  + mock-interview/  + grade-mock/
  docs/PLAN.md   (this document)
```

## 12. Scope
**In:** offline SWE interview-prep site — broad bank, typed questions, self-graded spaced repetition, checklist self-eval, Claude-Code content pipeline. Single user, local DB, free, no keys.
**Out:** accounts, payments, hosting/multi-device, runtime LLM, in-app question editing.

## 13. Open Decision (the one width fork)
**General software engineer** (add Coding Patterns + Frontend/Web tier, soften persona) — *recommended* — **vs keep senior-backend** as-is. Plan assumes broaden-to-general-SWE; trims to backend-only on request.

## 14. Verification
- Read `node_modules/next/dist/docs/` first (per AGENTS.md) before touching routes.
- After parser/import change: `npm run db:import` → check by-type counts + non-empty `rubric` for a sample topic (`prisma studio`).
- `npm run build && npm run start` (dev 500s on this box) → walk practice: question → reveal shows model answer + checklist → tick suggests rating → rating persists + SR advances (`Attempt`/`TopicProgress` in studio).
- Coverage report green for authored topics.
