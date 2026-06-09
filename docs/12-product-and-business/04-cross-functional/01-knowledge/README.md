# Cross-Functional Work — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Work with PM/design, requirement clarification, scope.

Senior backend engineers spend a large fraction of their impact *outside* the editor: clarifying ambiguous requirements, negotiating scope, surfacing technical constraints to non-engineers, and aligning PM, design, data, QA, and other engineering teams. The interview bar is "can this person turn a vague business ask into a shippable, correctly-scoped plan, and keep stakeholders aligned without an EM holding their hand." Technical brilliance with poor cross-functional skills caps you at mid-level.

---

## Core concepts

### The cross-functional cast and what each cares about
- **Product Manager (PM)** — owns the *what* and *why* (problem, priority, success metric). Cares about user value, timelines, scope. Does **not** own the *how*.
- **Designer (UX/UI)** — owns the user experience and flows. Cares about usability, consistency, edge-case states (empty/loading/error).
- **Data/Analytics** — owns measurement and instrumentation. Cares that you log the right events to evaluate success.
- **QA** — owns quality verification. Cares about testability, acceptance criteria, edge cases.
- **Other engineering teams / platform** — own shared services/contracts. Care about API stability, dependencies, coordination.
- **Support / Sales / CS** — the voice of the customer and the field; a source of real requirements and a downstream consumer of your changes.
- **Engineering Manager (EM)** — owns people/process, not the technical design.

A senior engineer's job is to make these perspectives *meet the constraints of what's buildable* — translating both directions.

### Requirements clarification
Requirements arrive vague, ambiguous, or solution-shaped. Your job is to make them **precise and testable** before building.
- **Functional requirements** — what the system must *do*.
- **Non-functional requirements (NFRs)** — how well: latency, scale, security, availability, compliance. These are *frequently unstated* and are where seniors add the most value by asking.
- **Acceptance criteria** — concrete, testable conditions for "done," ideally **Given/When/Then**. If you can't write acceptance criteria, the requirement isn't clear enough to build.
- **Solution vs. problem** — when a request is phrased as a solution ("add a dropdown"), trace back to the underlying **problem/job** (covered in Product Thinking). Often a better, cheaper solution emerges.

### Scope negotiation & the iron triangle
Scope, time, and quality/resources trade off ("pick two" / the project-management triangle). When something has to give, the senior move is to **make the tradeoff explicit and let the owner decide**, rather than silently cutting quality or slipping the date.
- **MoSCoW** (Must/Should/Could/Won't) is the common scope-cut tool with stakeholders.
- **Vertical slicing** lets you ship value early and renegotiate the rest.
- **"Yes, and here's the cost"** beats both a flat "no" and an over-promised "yes."

### Translating technical constraints to non-engineers
Stakeholders make better decisions when they understand the *cost and risk* in their terms, not yours. Skills:
- **Lead with impact, not mechanism** — "this adds two weeks and a scaling risk" before "because the join fans out."
- **Use analogies and ranges**, avoid jargon; give **options with tradeoffs**, not a lecture.
- **Quantify** — effort in time, risk as probability × cost, so PMs can weigh it against value.

### Disagree and commit
You can argue your position with evidence, but once the accountable owner decides (even against you), you commit fully and execute as if it were your idea. Endless re-litigation erodes trust; silent sabotage is worse. This is a core senior behavior interviewers specifically look for.

### Written communication artifacts
- **Design doc / RFC** — proposes an approach, surfaces alternatives and tradeoffs, invites review *before* building. The senior engineer's primary alignment tool.
- **ADR (Architecture Decision Record)** — captures a decision, its context, and consequences so future engineers know *why*.
- **One-pager / brief** — aligns stakeholders on problem and approach without a heavy doc.
- Async, written, durable communication scales across time zones and teams far better than meetings.

### RACI and ownership clarity
**R**esponsible, **A**ccountable, **C**onsulted, **I**nformed — a lightweight way to clarify who *does* the work, who *owns the decision*, who *gives input*, and who just needs *visibility*. Ambiguous ownership is a top cause of cross-functional friction and dropped balls.

---

## How it works under the hood (the senior workflow)

1. **Clarify the problem and success metric** with the PM before estimating. ("What does success look like? How will we measure it?")
2. **Surface the unstated NFRs** — scale, latency, security, compliance, edge-case states.
3. **Write testable acceptance criteria** (Given/When/Then); confirm with PM/QA/design.
4. **Estimate and surface tradeoffs** — effort, risk, dependencies — in stakeholder terms.
5. **Negotiate scope** explicitly (MoSCoW, vertical slice) when capacity < ask.
6. **Write it down** — a short design doc/RFC for anything non-trivial; align async.
7. **Coordinate dependencies** — agree on API contracts early so teams unblock in parallel; clarify RACI.
8. **Disagree-and-commit** on the final call; execute; close the loop on results.

---

## Key terms & definitions

- **Functional vs. non-functional requirement** — what it does vs. how well.
- **Acceptance criteria** — testable "done" conditions, often Given/When/Then.
- **NFR** — performance, security, scalability, availability, compliance requirements.
- **Iron triangle** — scope/time/cost(quality) tradeoff.
- **MoSCoW** — Must/Should/Could/Won't scoping.
- **RFC / design doc** — written proposal inviting review before building.
- **ADR** — recorded architectural decision + rationale.
- **RACI** — Responsible/Accountable/Consulted/Informed ownership matrix.
- **Disagree and commit** — argue, then fully support the decision once made.
- **Anti-corruption layer (org sense)** — a stable contract that shields your team from another team's churn.
- **Conway's law** — system structure mirrors org communication structure.

---

## Tradeoffs

- **Speed of alignment vs. thoroughness** — a heavyweight design-review process aligns deeply but slows small work; match ceremony to stakes.
- **Saying yes (relationship) vs. protecting scope/quality** — over-accommodating breeds scope creep and burnout; resolve with "yes, and here's the cost."
- **Sync meetings vs. async docs** — meetings build rapport and resolve ambiguity fast; docs scale and create a record. Use meetings to *decide*, docs to *align and persist*.
- **Engineering ideal vs. business reality** — the "right" architecture may not fit the deadline; seniors find the defensible middle and name the debt.
- **Following the spec vs. pushing back** — blind execution ships the wrong thing; constant pushback stalls delivery. Calibrate with data.

---

## Common pitfalls & misconceptions

- **Building from an ambiguous spec** without clarifying, then shipping the wrong thing ("but the ticket said...").
- **Silent scope creep** — absorbing every "small" addition without renegotiating time/scope.
- **Saying "no" flatly** instead of "yes, and here's the tradeoff" — or saying "yes" and missing the date.
- **Drowning non-engineers in jargon** instead of leading with impact and options.
- **Re-litigating decided questions** instead of disagree-and-commit.
- **No written record** — decisions made verbally, then disputed or forgotten.
- **Treating the PM as the boss of the *how*** — or, conversely, ignoring the PM's ownership of priority.
- **Hero-coding around process** instead of coordinating dependencies, causing integration surprises.
- **Ignoring instrumentation/QA** until launch, then unable to measure or verify success.

---

## What interviewers probe

- *"A PM gives you a vague one-line feature request. What do you do first?"* — Clarify problem/success metric, surface NFRs, write acceptance criteria — *before* estimating.
- *"You disagree with the PM/design on the approach. How do you handle it?"* — Evidence-based pushback, propose alternative, disagree-and-commit.
- *"The deadline can't fit the scope. What do you do?"* — Make the tradeoff explicit (MoSCoW / triangle), recommend, let the owner decide.
- *"Explain a technical constraint to a non-technical stakeholder."* — Lead with impact, options, ranges; no jargon.
- *"Two teams' work depends on each other and you're blocked. How do you unblock?"* — Agree contracts early, clarify RACI, communicate proactively.
- Red flags: builds without clarifying, can't say no, can't disagree-and-commit, can't translate tech to business, blames PM/design, no written alignment.

---

## Quick-reference summary

- **Clarify before you build:** problem, success metric, unstated **NFRs**, and **testable acceptance criteria** (Given/When/Then).
- Trace **solution-shaped requests back to the problem**.
- When capacity < ask, **make the scope/time/quality tradeoff explicit** (MoSCoW, vertical slice) and let the owner decide — **"yes, and here's the cost."**
- **Translate tech to business:** lead with impact, give options with quantified cost/risk, drop the jargon.
- **Disagree and commit:** argue with evidence, then fully support the decision.
- **Write it down:** RFC/design doc to align, ADR to record *why*.
- **Clarify ownership (RACI)** and **agree API contracts early** to unblock teams in parallel.
