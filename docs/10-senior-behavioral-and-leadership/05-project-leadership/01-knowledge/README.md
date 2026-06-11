# Project Leadership — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Driving ambiguous projects, cross-team coordination.

> **🛒 Where we are in building ShopFast** — In the previous topic we learned how to [communicate and align people through RFCs and stakeholder management](../../04-communication/01-knowledge/README.md). Now ShopFast is ready for its biggest challenge yet: a cross-team, cross-functional launch with an external payment provider, a mobile team, and a third-party logistics partner — all on a fixed date with real business consequences. This topic teaches the judgment behind driving that kind of ambiguous, cross-cutting project to a shipped, measured result without formal authority. **Next:** once ShopFast is live, real incidents will happen — [Incident Response](../../../11-real-situations/01-incident-response/01-knowledge/README.md) covers how to handle them.

---

## Teaching arc: driving ShopFast's cross-team launch

### What it is & why it matters

**Project leadership** is owning an ambiguous, cross-cutting outcome end to end — turning "we should solve X" into a shipped, measured result, often without formal authority over the people involved. Interviews probe whether you can create clarity from ambiguity, coordinate across teams, drive without managing, and take ownership of the outcome (not just your slice).

Why do seniors get paid extra for this? Because the most expensive projects fail at the **seams** — the handoffs between teams, the dependencies nobody officially owns, the integration work that falls through because it belongs to everyone and no one. A senior who owns those seams — even when it is not their code, not their team, not their job description — is the difference between a launch and a slip.

### A ShopFast case

**Framing.** ShopFast is 10 weeks from launch. The checkout flow is built, but getting it live requires coordinating three groups who do not report to the same manager: the backend team (order/payment module), the mobile team (iOS and Android checkout UI), and a third-party payment provider (Stripe) integration that requires a compliance review. The product manager sets a hard launch date — it is on a press release. The senior engineer is asked to "lead" the launch. They have zero authority over the mobile team and no way to compel the compliance team.

**Creating clarity.** The engineer's first job is to **reduce ambiguity**. In the first week, they produce: (1) a shared definition of "done" — exactly what "launched" means (checkout works on web and mobile, payment succeeds, order confirmation email sends, error states handled); (2) a milestone map with four demonstrable checkpoints; (3) a **RACI (Responsible, Accountable, Consulted, Informed)** chart that makes ownership explicit — the mobile lead is R (Responsible) for the iOS checkout UI, the backend lead is R for the payment module, the engineer is A (Accountable) for the overall launch outcome; (4) an explicit **critical path** — the dependency chain that determines the end date. The critical path runs: compliance review approval → Stripe production credentials → backend payment integration → mobile integration test. Every other work stream has slack; the compliance review has none.

**Owning the seams.** The engineer identifies the three seams where the project can fail: (1) the API contract between backend and mobile — they write it as an RFC (Request For Comments) and get both teams to sign off in week 2; (2) the Stripe webhook delivery to ShopFast's order status queue — they write an explicit integration test contract; (3) the compliance review timeline — they escalate to the product manager at week 3 when the review is two days late, with a clear re-baseline: "If approval slips one more week, we cut the saved-payment-methods feature from launch and ship it in sprint 2."

**Managing the critical path.** At week 6, the compliance review finally clears but the Stripe production credentials take an extra three days. The engineer immediately re-sequences: mobile integration testing moves from week 7 to week 8, absorbing the slip within the existing slack. The launch date holds. The engineer communicates the slip proactively to the product manager with a one-sentence update: "Credentials arrived 3 days late; we absorbed it in testing slack; launch date unchanged."

**Driving the last 20%.** At week 9, the checkout is "feature complete" — but integration testing has exposed four edge cases (retry on network timeout, cart-to-order race condition, failed payment state recovery, email delay display). No individual team owns these edge cases; they fall across the seams. The engineer schedules a focused "seam week" with representatives from each team, triages the four issues, and drives them to resolution. Two are fixed; two are deferred behind feature flags with explicit monitoring alerts.

**Landing and measuring.** Launch day: the engineer monitors the first 100 real orders live. Two alerts fire — both expected and pre-configured. Post-launch retro (retrospective) identifies one thing to improve: the compliance review timeline was not tracked in the risk register from week 1. Next time: external reviews go on the critical path from day 1.

### How to handle it

1. **Create clarity from ambiguity first.** Define the goal and success metric measurably, identify constraints, map unknowns, and produce a plan others can rally around. Do this in week 1, not week 5.
2. **Build a RACI/DACI.** Make ownership gaps visible. RACI (Responsible, Accountable, Consulted, Informed) or DACI (Driver, Approver, Contributor, Informed) — pick one, use it consistently.
3. **Identify and protect the critical path.** The critical path is the dependency chain that determines the end date. Slip anywhere on it slips everything. Track it explicitly; do not let slack on non-critical work create false comfort.
4. **Own the seams.** The places where teams hand off to each other — API contracts, integration test contracts, shared queues — are where projects fail. Own them even if they are not your code.
5. **Surface risks early.** A risk at week 2 is a plan change; at week 10 it is a crisis. Maintain a lightweight risk register: top risks, likelihood, impact, mitigation, owner.
6. **Drive the last 20%.** "Feature complete" is not shipped. The integration, edge cases, rollout, monitoring, and documentation are where project leaders earn their keep. Nobody volunteers for this work.
7. **Re-baseline openly.** When reality changes, reset scope, timeline, or both openly — no surprises. The "no surprises" rule from the communication topic applies doubly here.

For **leading without authority**: influence comes from a clear and compelling plan, credibility from delivering, making others' jobs easier, and aligning the work to shared goals. You lead by clarity and trust, not org-chart power.

### A strong answer sounds like

> "When ShopFast was heading toward its launch, I owned the cross-team coordination even though I had no authority over the mobile team or the compliance process. My first move was to reduce ambiguity: write the definition of done, produce a RACI, and map the critical path explicitly. The compliance review was on the critical path and nobody was treating it that way — I put it in the risk register in week 1 and escalated at week 3 when it was slipping. We re-baselined one feature out of launch scope rather than miss the date. At week 9, the edge cases across the seams were falling through because they belonged to everyone and no one. I ran a 'seam week,' triaged the four issues myself, drove two to resolution, and put two behind feature flags with alerts. We launched on time. The retro finding was that external-dependency timelines should go on the critical path from day 1 — I apply that to every project now."

STAR (Situation, Task, Action, Result): Situation is a cross-team launch with a hard date, Task is driving it to shipped without authority, Action is the RACI + critical path + seam ownership + risk register + seam week, Result is on-time launch with two post-launch alerts (expected) and one clear process improvement.

### Pitfalls

- **Confusing authority with leadership** — waiting to be "in charge" instead of leading through clarity and credibility.
- **Owning only your slice** — letting the project fail at the seams because "that's another team's problem."
- **Ignoring the critical path** — optimizing non-critical work while the bottleneck slips.
- **Surfacing risks late** — turning a manageable risk into a crisis.
- **The hero trap** — doing all the hard work yourself; no delegation, no team growth, huge bus factor.
- **Abandoning the last 20%** — declaring victory at "feature complete" before integration/rollout/edge cases.
- **No clear roles** — ownership gaps (things fall through) or turf wars (duplicated/contested work).
- **Surprising sponsors** — not re-baselining when scope or timeline shifts.
- **Micromanaging** — delegating tasks but not trust, capping the team at your bandwidth.

---

## Core concepts

### Driving without authority
Senior tech leads usually lead **laterally** — they don't manage the people they depend on. Influence comes from: a clear and compelling plan, credibility from delivering, making others' jobs easier, and aligning the work to shared goals. You lead by **clarity and trust**, not org-chart power. This is the defining skill the role tests.

### Creating clarity from ambiguity
An ambiguous project is one where the *problem*, *solution*, and *success* are all fuzzy. The leader's first job is to **reduce ambiguity**:
- Pin down the **goal and success metric** ("what does done/good look like, measurably?").
- Identify **constraints** (deadline, budget, headcount, dependencies).
- Map the **unknowns** and attack the riskiest first (spikes).
- Produce a **plan** — milestones, owners, sequencing — that others can rally around.

### Ownership and accountability
The leader owns the **outcome**, not just their tasks. That means tracking the whole, unblocking others, surfacing risks early, chasing the dependencies nobody else owns, and being the person who ensures it *actually ships and works* — including the unglamorous integration and edge work. "Extreme ownership": when the project fails, the leader looks at what *they* could have done, not who to blame.

### Cross-team coordination
Projects that span teams fail at the **seams**. The leader's job is to own the seams: explicit interfaces/contracts between teams, clear dependency ownership and dates, a shared source of truth, and a cadence that surfaces slips early. Brooks's Law warns that adding people (or teams) increases communication overhead non-linearly — coordination cost is the hidden tax.

### Execution mechanics
- **RACI/DACI:** clarify who's Responsible, Accountable, Consulted, Informed (or Driver/Approver/Contributor/Informed) so there are no ownership gaps or turf wars.
- **Milestones with demonstrable value:** sequence so each milestone de-risks and shows progress.
- **Status/cadence:** a regular, written, risk-forward update keeps everyone aligned and surfaces problems early.
- **Definition of done:** explicit, so "done" isn't a debate.

### Managing risk and the critical path
Identify the **critical path** (the chain of dependent work that determines the end date) and protect it relentlessly — slack elsewhere doesn't matter, slip on the critical path slips everything. Maintain a lightweight **risk register**: top risks, likelihood, impact, mitigation, owner. Surface risks *early* — a risk raised at week 2 is a plan change; the same risk at week 10 is a crisis.

---

## How leadership drives a project under the hood

### Kickoff → execution → landing
1. **Kickoff:** align on goal, success metric, scope (in/out/later), roles (RACI), and the high-level plan. Get explicit buy-in.
2. **De-risk early:** spike the scary unknowns; build the walking skeleton; validate the riskiest assumptions.
3. **Execute with cadence:** track milestones, unblock relentlessly, communicate status with risks forward.
4. **Land it:** drive the unglamorous last 20% (integration, edge cases, rollout, docs), measure against the success metric, and run a retro.

### The 90% trap
Projects are notoriously "90% done" for half their duration. The leader's value shows in driving the *last* 20% — the integration, the long-tail bugs, the rollout, the cleanup — that nobody volunteers for. Owning the landing is what separates a leader from a contributor.

### Delegation and leverage
A leader multiplies the team: delegate ownership (not just tasks) with context and a clear outcome, then get out of the way and support. Hoarding the interesting work or micromanaging caps the project at one person's throughput and starves others' growth.

### Stakeholder & expectation management
Keep sponsors aligned on scope, timeline, and risk. Re-baseline openly when reality changes (no surprises). Protect the team from thrash by absorbing and filtering external noise.

---

## Key terms & definitions

| Term | Definition |
|------|-----------|
| Lead without authority | Drive outcomes via influence/clarity, not reporting lines. |
| Extreme ownership | Owning the whole outcome and failures, not just your tasks. |
| RACI / DACI | Role clarity: Responsible/Accountable/Consulted/Informed (or Driver/Approver/Contributor/Informed). |
| Critical path | The dependency chain that determines the project end date. |
| Risk register | Tracked list of top risks with likelihood, impact, mitigation, owner. |
| The seams | Cross-team interfaces/dependencies where projects fail. |
| 90% trap | Projects stall in the unglamorous last stretch. |
| Brooks's Law | Adding people to a late project makes it later (communication overhead). |
| Definition of done | Explicit, agreed completion criteria. |
| Re-baselining | Openly resetting plan/scope/date when reality changes. |

---

## Tradeoffs

- **Plan up front vs adapt as you go:** too much planning ignores what you'll learn; too little leaves people directionless. Plan the spine and the next milestone in detail; keep the rest light and adaptive.
- **Drive hard vs protect the team:** pushing pace ships faster but risks burnout and quality; over-protecting slips dates. Read the situation and the people.
- **Delegate vs do it yourself:** doing it yourself is faster *this time* but caps leverage and starves growth; delegating costs ramp-up but scales the team.
- **Process vs autonomy:** more process (status, RACI, gates) reduces chaos at scale but adds overhead; small efforts need almost none. Match process weight to project size and risk.

---

## Common pitfalls & misconceptions

- **Confusing authority with leadership** — waiting to be "in charge" instead of leading through clarity and credibility.
- **Owning only your slice** — letting the project fail at the seams because "that's another team's problem."
- **Ignoring the critical path** — optimizing non-critical work while the bottleneck slips.
- **Surfacing risks late** — turning a manageable risk into a crisis.
- **The hero trap** — doing all the hard work yourself; no delegation, no team growth, huge bus factor.
- **Abandoning the last 20%** — declaring victory at "feature complete" before integration/rollout/edge cases.
- **No clear roles** — ownership gaps (things fall through) or turf wars (duplicated/contested work).
- **Surprising sponsors** — not re-baselining when scope or timeline shifts.
- **Micromanaging** — delegating tasks but not trust, capping the team at your bandwidth.

---

## What interviewers probe

- "Tell me about an ambiguous project you drove." → How you created clarity (goal, metric, plan), de-risked, and landed it; ownership of the *outcome*.
- "How do you lead people you don't manage?" → Influence, credibility, making the plan compelling, aligning to shared goals.
- "Tell me about a cross-team project." → Owning the seams, dependency management, surfacing slips early.
- "A project was at risk of missing its date — what did you do?" → Critical path, re-baselining, scope cuts, escalation with data.
- "Tell me about a project that failed." → Extreme ownership, specific lessons, no blame-shifting.

Red flags: only owning their own tasks, waiting for authority, hero behavior, no risk/critical-path awareness, surprising stakeholders, or blaming others for failures.

---

## Quick-reference summary

- Lead **without authority** via clarity, credibility, and aligning to shared goals.
- First job in ambiguity: **define the goal, success metric, scope, roles, and plan.**
- **De-risk early** (spikes, walking skeleton); attack the critical path's unknowns first.
- Own the **outcome and the seams**, not just your slice — extreme ownership.
- Use **RACI/DACI** for role clarity; maintain a **risk register**; protect the **critical path**.
- Communicate status with **risks forward**; **re-baseline** openly — no surprises.
- Drive the unglamorous **last 20%** (the 90% trap); own the landing.
- **Delegate ownership**, not just tasks; don't be the hero. Match process weight to project size.
