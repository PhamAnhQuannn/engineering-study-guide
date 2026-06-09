# Project Leadership — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Driving ambiguous projects, cross-team coordination.

Project leadership is owning an **ambiguous, cross-cutting outcome** end to end — turning "we should solve X" into a shipped, measured result, often without formal authority over the people involved. Interviews probe whether you can create clarity from ambiguity, coordinate across teams, drive without managing, and take ownership of the outcome (not just your slice).

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
| RACI / DACI | Role clarity: Responsible/Accountable/Consulted/Informed (or Driver/Approver/...). |
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
