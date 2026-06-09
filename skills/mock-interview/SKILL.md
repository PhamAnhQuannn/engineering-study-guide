---
name: mock-interview
description: Live adaptive mock interview run by Claude Code against the local question bank — no API key, no runtime AI. Claude plays interviewer, asks one question at a time, grades the user's typed answer against the question's checklist (rubric) + gradeGuidance, asks adaptive follow-ups, and ends with a transcript + scorecard. Can update content mid-session (add/sharpen questions or checklists) then re-import. Use when the user says "mock interview", "interview me", "/mock-interview".
---

# /mock-interview — Live Mock Interview (Mode B)

The runtime app (`/mock`) is offline/no-AI. THIS skill is the live, adaptive interviewer — it runs inside Claude Code (the dev/session-time intelligence), so it needs no API key. See `docs/PLAN.md` §C Mode B.

## Inputs (ask if missing)
- **Focus**: a tier, topic slug(s), or "mixed senior backend loop". Default: Senior Backend Loop (KNOWLEDGE×2 → CODING → SYSTEM_DESIGN → BEHAVIORAL).
- **Count**: number of questions (default 5).
- **Source of truth for questions**: the `docs/<tier>/<topic>/<category>/README.md` bank (parser format in `docs/PLAN.md` §6), or the imported DB (`prisma studio` / query). Prefer reading the markdown directly.

## Procedure
1. **Pick the set.** Choose `count` questions matching the focus, mixing types like a real loop. Prefer questions the user hasn't done recently if that's known. List nothing up front — reveal one at a time.
2. **Ask one at a time.** Present ONE question. Do not show the model answer or checklist. Wait for the user's typed answer.
3. **Grade live.** Compare the answer against:
   - the question's **checklist (rubric)** — the key points a strong senior answer must hit (Lens 1), and
   - the type's **`gradeGuidance`** from `lib/questionTypes.ts`.
   Give: a score (0–100), which checklist points were hit/missed, and 2–3 sentences of specific feedback. Be a tough but fair senior interviewer — reward depth, tradeoffs, failure-modes; penalize hand-waving.
4. **Adaptive follow-up.** If the answer is weak or shallow on a key point, ask ONE targeted follow-up that drills there before moving on. (This is what the static app can't do.)
5. **Next question.** Repeat 2–4 until the set is done.
6. **Scorecard + transcript.** Summarize: overall, per-type, per-topic, weak areas, and the 2–3 highest-leverage things to study next. Offer to write the transcript to `docs/qa/mock-<date>.md`.

## Content improvement (optional, same session)
If during grading you find a question that is weak, ambiguous, or lacks a checklist:
- Offer to fix it in the `docs/` markdown (sharpen the prompt, correct the model answer, or add a `**Checklist**` block in the §6 format).
- After edits, tell the user to run `npm run db:import` (and `npm run db:coverage`) to load the changes. This is the "update content live" loop.

## Hard boundary
- This skill is dev/session-time only. NEVER wire a runtime model/API call into the app. The website stays 100% offline (decision #6).
- Grade honestly; do not inflate scores. If the user asks you to just pass them, decline and keep the bar at senior level.

## Example trigger
User: "/mock-interview senior backend, 5 questions" → pick a Senior Backend Loop set from the bank, ask Q1, grade against its checklist + gradeGuidance, follow up where weak, … , end with scorecard + offer to save transcript.
