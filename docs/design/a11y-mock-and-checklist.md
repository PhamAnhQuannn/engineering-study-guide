---
feature: mock-interview + checklist-grade
target: WCAG 2.2 AA
last-updated: 2026-06-08
status: draft
---

# A11y Design: Mock Interview + Checklist Grade

Wireframes: `docs/design/wireframes/mock-run.md`, `mock-review.md`, `mock-scorecard.md`, `checklist-grade.md`, `progress-additions.md`. Flows: `docs/design/flows/`.

Keyboard-first offline app. Native HTML first; ARIA only where no semantic element fits.

## Landmarks (all screens)
| Element | Role / Tag |
|---|---|
| App nav | `<nav aria-label="Primary">` (existing) |
| Page content | `<main>` |
| Mock run question | `<section aria-labelledby="q-heading">` |
| Timer | `<div role="timer" aria-live="polite">` |
| Scorecard sections | `<section aria-labelledby>` per (by-type, by-topic, weak) |

## Keyboard Map
| Key | Context | Action |
|---|---|---|
| Tab / Shift+Tab | global | move focus; logical order per screen |
| Ctrl/Cmd+Enter | mock run | Submit & next |
| (button) Enter/Space | Skip / End mock | activate |
| Space | checklist item | toggle ticked |
| 1 / 2 / 3 | reveal/review/checklist | Again / Good / Easy (override suggestion) |
| Enter | review | Next |
| Esc | End-mock confirm modal | Cancel (dismissable — unlike a payment hold) |

Note: `1/2/3` only bind when focus is NOT in a text/Monaco/answer field (don't hijack typing). Bind them on the reveal/review region, and ignore when an editable control has focus.

## Tab Order
**Mock run:** Q-heading (focus target, not tabbable) → AnswerInput → Skip → Submit → End mock.
**Review:** recap → your-answer → model answer → checklist items (each a checkbox) → rating buttons → Next.
**Scorecard:** heading → by-type → by-topic → weak "Practice these" links → Review answers → Done.

## Focus Management
| Trigger | Focus moves to |
|---|---|
| New question loads (run) | the question `<section>` heading (`tabindex=-1`, programmatic focus) so SR reads the new prompt |
| Submit/Skip → next | next question heading |
| Enter review phase | first review question heading |
| Reveal in review | stays; checklist is next in tab order (don't steal focus) |
| Next (review) | next question heading |
| End-mock modal open | modal heading; focus trapped; Esc/Cancel returns focus to End-mock trigger |
| Scorecard render | scorecard `<h1>` |
| api/answer error | the inline retry control for that question, with `role="alert"` |

## ARIA Patterns
| Pattern | Approach |
|---|---|
| Timer | `role="timer"`, `aria-live="polite"`. Announce sparingly — NOT every second. Announce at: start, 30s-left, 0/over. "Over time" toggles an `aria-live` message once, not continuously. |
| Checklist | native `<input type="checkbox">` + `<label>`; group in `<fieldset>` with `<legend>` "What a strong answer covers". |
| Coverage % | `aria-live="polite"` region; announce on change but debounced ("Coverage 67 percent, suggested Good"). |
| Rating buttons | native `<button>`; suggested one has `aria-pressed="true"` (preselected) but all activatable. |
| MCQ result | text "Correct"/"Incorrect" + icon, not color-only; `role="status"`. |
| End-mock modal | native `<dialog>` or Radix Dialog (focus trap built-in). |
| Scorecard bars | each bar = label + numeric value in text; `role="img"` w/ `aria-label="Design 50 of 100, weak"` OR plain text + visually-hidden value. |

## Screen-Reader Script — mock run (new question)
1. "Question 3 of 5, heading" (focus on new prompt)
2. "System design" (type)
3. "Design a rate limiter for a public API…" (prompt)
4. "Your answer, edit text" (AnswerInput)
5. timer announces only at thresholds: "2 minutes left, timer" … "Time up, over time, timer"
6. "Skip, button" … "Submit and next, button"

## Screen-Reader Script — checklist grade
1. "What a strong answer covers, group"
2. "Defines the collision case, checkbox, not checked"
3. (tick) "checked. Coverage 33 percent, suggested Again" (polite)
4. "Again, button, pressed" / "Good, button" / "Easy, button"

## Monaco (code answers) caveats
- Monaco is a custom editor; ensure `aria-label` on the editor instance ("Code answer").
- It traps Tab (inserts indentation) by default — provide an Escape-then-Tab affordance or a documented "Ctrl/Cmd+Enter to submit" so keyboard users can leave the editor. Document the editor's own a11y help (Monaco has built-in `Alt+F1`).
- Don't bind 1/2/3 ratings while Monaco has focus.

## Color Contrast (Tailwind defaults in use; flag violators)
| Foreground | Background | Pass AA? |
|---|---|---|
| default text on white/dark | per existing theme | ✅ (existing app passes) |
| rating colors (red/blue/green text on tint) | existing RevealPanel | ✅ as used (text shade, not fill) |
| **timer warn color** (amber on white) | — | ⚑ if amber-500 used for "time low/over", verify ≥4.5:1; if not, use a darker amber (e.g. amber-700). Don't rely on color alone — also show "over time" text + ⚑. |
| weak-area flag | — | must be label + ⚑ icon + value, NOT color-only |

No status conveyed by color alone anywhere (over-time, weak, correct/incorrect all carry text/icon).

## Motion (`prefers-reduced-motion`)
| Animation | Default | Reduced |
|---|---|---|
| Timer pulse when low/over | subtle pulse | no pulse — color + text only |
| Question/step transition | fade 150ms | none/instant |
| Score bars grow-in | width transition | render at final width |

## Touch Targets
All buttons (Submit/Skip/End, rating, checklist rows, Next, Practice links) ≥ 44×44 CSS px hit area. Checklist: 24px visual box + padded 44px row.

## Misc
- `beforeunload` warning on run is a browser dialog (inherently accessible); also keep an in-page "End mock" as the intended exit.
- Skip-to-main link belongs in the app layout (site-wide), not per screen.
- Headings: one `<h1>` per screen state (run = "Mock interview", scorecard = "Mock complete").

## Out of Scope
- AAA contrast; high-contrast mode (defer to system).
- Post-impl axe-core/Lighthouse audit (run via Playwright later — see `/smoke-test`).

## Open Questions
- Announce per-question time taken in review? Default: yes, in the recap line (text).
