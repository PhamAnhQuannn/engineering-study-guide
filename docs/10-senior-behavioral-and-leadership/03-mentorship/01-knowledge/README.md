# Mentorship — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Unblocking juniors, code review culture, growing others.

A senior engineer's leverage is multiplicative: the code you write scales linearly, but the engineers you grow scale the whole team. Interviews probe whether you can **unblock without taking over**, **review to teach not just to gate**, and **create the conditions for others to grow** — sponsorship, psychological safety, and feedback that lands.

---

## Core concepts

### Teaching vs telling (the unblocking spectrum)
When a junior is stuck, there's a spectrum from "tell them the answer" to "let them struggle." The senior skill is **calibrating to urgency and learning value**:
- **High urgency (prod is down):** tell them, fix it, debrief later. Teaching can wait; the outage can't.
- **Low urgency, high learning value:** ask guiding questions, let them find it. The struggle *is* the learning.
- **Repeated stuck on the same thing:** that's a gap to address directly — pair on it, then give them the pattern.

The goal is to **transfer capability**, so next time they're not blocked. Solving it *for* them every time creates dependency, not growth.

### Code review as a teaching tool
Code review is the highest-frequency mentorship surface most teams have. A senior review:
- **Separates blocking from non-blocking feedback.** Mark nits as nits ("nit:" / "optional:"); reserve "request changes" for correctness, security, and design issues.
- **Explains the *why*,** not just the *what*. "Use a map here" teaches nothing; "a map gives O(1) lookups and we call this in a loop, so it avoids the O(n²)" teaches.
- **Asks questions instead of issuing decrees** where reasonable ("what happens if this list is empty?") — invites thinking over compliance.
- **Praises good work,** not only flags problems. Reinforcement shapes behavior.
- **Reviews promptly.** A PR sitting for two days blocks a person and signals low priority.

### Psychological safety
People learn and surface problems only when it's safe to be wrong. Senior engineers build safety by admitting their own mistakes, responding to "dumb questions" without judgment, running blameless retros, and never punishing the messenger. Without safety, juniors hide confusion and bugs — the opposite of what you want.

### Sponsorship vs mentorship
- **Mentorship:** advice and skill-building given *to* someone (private).
- **Sponsorship:** spending your own credibility to advocate *for* someone — assigning them a stretch project, naming them in a room they're not in, crediting their work publicly. Sponsorship is what actually moves careers; many seniors mentor but never sponsor.

### Growth: stretch, not drown
Assign work just beyond current ability — a **stretch assignment** — with a safety net (your availability, a clear escape hatch). Too easy and they stagnate; too hard with no support and they fail and lose confidence. This is the "zone of proximal development."

---

## How effective mentorship works under the hood

### The "show, pair, watch, delegate" ladder
1. **Show:** do it while they watch, narrating your reasoning (model the thinking, not just the keystrokes).
2. **Pair:** do it together, hands on keyboard shared.
3. **Watch:** they drive, you observe and prompt.
4. **Delegate:** they own it; you're available but hands-off.
Moving down this ladder transfers ownership progressively. Staying at "show" forever creates dependency.

### Feedback that lands
- **Timely + specific + actionable.** "Be more careful" is useless; "the PR had three null-pointer risks we caught in review — let's add a null check habit and I'll show you the linter rule" is actionable.
- **SBI (Situation–Behavior–Impact):** describe the situation, the specific behavior, and its impact — avoids character judgments.
- **Praise in public, correct in private** for anything that could embarrass.
- **Radical candor:** care personally *and* challenge directly. Neither "ruinous empathy" (too nice to give real feedback) nor "obnoxious aggression" (candor without care).

### Growing seniors, not just juniors
Senior mentorship isn't only about juniors. It includes raising the team's bar: establishing review norms, writing exemplary code/docs as references, running brown-bags, and pushing peers' designs to be better through respectful challenge.

---

## Key terms & definitions

| Term | Definition |
|------|-----------|
| Unblocking | Removing what stops someone progressing — ideally by transferring capability, not just solving it. |
| Sponsorship | Spending your credibility to advocate for someone's advancement. |
| Psychological safety | Shared belief that it's safe to take risks, ask, and be wrong. |
| Stretch assignment | Work slightly beyond current ability, with a safety net. |
| Blocking vs non-blocking feedback | Must-fix (correctness/security/design) vs optional (style/nits). |
| SBI | Situation–Behavior–Impact feedback model. |
| Radical candor | Care personally + challenge directly. |
| Zone of proximal development | The band of tasks one can do with help but not alone yet. |
| Bus factor | How many people can leave before knowledge is lost; mentorship lowers risk. |
| Show/pair/watch/delegate | Progressive ownership-transfer ladder. |

---

## Tradeoffs

- **Speed of unblocking vs depth of learning:** telling is fast but shallow; coaching is slow but durable. Match to urgency.
- **Code-review thoroughness vs throughput:** exhaustive reviews teach but slow delivery and can demoralize. Calibrate depth to risk and author seniority.
- **Standards vs autonomy:** enforcing your way teaches a pattern but stifles ownership; too much "your call" leaves juniors without guardrails.
- **Mentoring time vs your own delivery:** mentorship is real, often-invisible work that trades against your individual output. Seniors are evaluated on team leverage, so it's a *good* trade — but it must be budgeted, not squeezed into nothing.

---

## Common pitfalls & misconceptions

- **Solving everything for them** — creates dependency and steals the learning.
- **Code review as a power trip** — nitpicking, ego, "I would have done it differently" without a real reason.
- **Mixing nits with blockers** — the author can't tell what actually must change.
- **Mentoring but never sponsoring** — advice is cheap; advocacy is what advances people.
- **No psychological safety** — juniors hide confusion; bugs and bad designs surface late.
- **Vague feedback** — "be better" with no specific behavior or next step.
- **Public correction** — embarrasses and kills safety; correct sensitive things privately.
- **One-size-fits-all** — the same approach for a nervous new grad and a confident mid-level fails both.
- **Hero culture** — being the only one who can fix X. A good mentor *removes* their own bus-factor risk.

---

## What interviewers probe

- "Tell me about someone you helped grow." → Concrete actions, the ladder, sponsorship, and *their* outcome (promotion, ownership), not just "I gave advice."
- "How do you give code review feedback?" → Blocking vs non-blocking, explaining why, tone, promptness.
- "A junior keeps getting stuck on the same thing — what do you do?" → Diagnose the gap, pair, transfer the pattern; don't just keep solving it.
- "How do you give hard feedback?" → Specific, timely, private, SBI/radical-candor, with a path forward.
- "How do you build a healthy review/team culture?" → Norms, safety, leading by example.

Red flags: taking credit for others' growth, ego in reviews, inability to name a specific person they grew, or only ever "telling."

---

## Quick-reference summary

- Unblock by **transferring capability**, not just solving — calibrate telling vs coaching to urgency.
- Use the **show → pair → watch → delegate** ladder to hand off ownership.
- In code review: **separate nits from blockers**, explain the **why**, ask questions, praise, review **promptly**.
- Build **psychological safety**: admit your mistakes, blameless retros, no punishing the messenger.
- **Sponsor**, don't just mentor — advocate with your own credibility.
- Give **stretch** assignments with a safety net.
- Feedback = **specific + timely + actionable**, public praise / private correction, radical candor.
- A good mentor **lowers their own bus factor**, not raises it.
