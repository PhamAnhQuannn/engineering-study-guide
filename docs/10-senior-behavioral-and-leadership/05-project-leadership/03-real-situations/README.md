# Project Leadership — Real-World Situations

[← Topic overview](../README.md)

> Topic: Driving ambiguous projects, cross-team coordination.

On-the-job scenarios. Each follows: **model the approach → diagnose → communicate → resolve/fix → prevention.**

---

### S1. You're handed a vague mandate — "make checkout faster" — with no spec, metric, or team

**Approach:** Your first job is to manufacture clarity, not to start coding.

**Diagnose:** Define "faster" measurably — is it p95 page load, conversion rate, or backend latency? Pull current numbers to establish a baseline and find where the time actually goes (profile before optimizing).

**Communicate:** Write a one-pager: the problem, a concrete success metric ("p95 checkout < 1.5s, +X% conversion"), scope in/out, and a milestone plan. Get sponsor sign-off so you're solving the *right* problem.

**Resolve:** Attack the biggest measured bottleneck first (risk/impact-first), ship in slices, measure against the metric.

**Prevention:** Establish that ambiguous mandates get a written goal + metric before execution, so effort isn't spent optimizing the wrong thing.

---

### S2. A cross-team project is failing at the seams — each team built its part but nothing integrates

**Approach:** Own the seams nobody owned. Force end-to-end integration.

**Diagnose:** Map the interfaces between teams — where are the contract mismatches? Likely each team made reasonable but divergent assumptions about the boundary.

**Communicate:** Get the teams in one room, make the dependencies and contracts explicit, and assign an owner to each seam. Establish a shared source of truth.

**Resolve:** Define interface contracts, build a thin end-to-end integration first (walking skeleton across teams), and drive the integration bugs to closure.

**Prevention:** For future cross-team work, define interface contracts and seam owners *up front*, integrate continuously rather than at the end, and run a regular cross-team sync that surfaces mismatches early.

---

### S3. Halfway through, it's clear the project will miss its date

**Approach:** Re-baseline openly and early; don't hope it recovers.

**Diagnose:** Identify the critical path and where it's slipping. Quantify the gap and separate must-haves from nice-to-haves.

**Communicate:** Tell sponsors now, with options: cut scope to hit the date, slip the date for full scope, or (rarely) add help to parallelizable work. Recommend one. No surprises.

**Resolve:** Usually cut scope to the minimum coherent release, defer the rest to "later," protect the critical path, and re-plan.

**Prevention:** Track the critical path and a risk register from the start, with a status cadence that flags slip early — when it's a plan change, not a crisis.

---

### S4. You're leading people who don't report to you and one team keeps deprioritizing your work

**Approach:** Lead through influence and alignment, then escalate with data if needed.

**Diagnose:** Understand *their* priorities — you're probably competing with their own roadmap. Confirm the impact of their deprioritization on your critical path.

**Communicate:** Make the shared goal compelling and make their part easy (clear asks, reduced overhead). If it persists, escalate to the shared manager framed as "here's the risk to the org goal and the options," not "they won't help me."

**Resolve:** Negotiate a firm commitment, a reduced ask, or a workaround (stub their dependency to unblock yourself) while the priority gets sorted.

**Prevention:** Secure explicit cross-team commitments and sponsor backing at kickoff so priorities are aligned before execution, not negotiated mid-flight.

---

### S5. The project is "90% done" for weeks and the team has lost momentum on the boring last 20%

**Approach:** Own the landing — the unglamorous last stretch is where leadership shows.

**Diagnose:** Enumerate what's actually left: integration, edge cases, rollout, docs, the long-tail bugs. "Feature complete" hid a lot of real work.

**Communicate:** Reset the framing — "feature complete ≠ done" — and make the remaining work visible with clear owners and a definition of done.

**Resolve:** Break the last 20% into concrete tasks, take on the gnarliest unowned bits yourself if needed, drive a real rollout plan, and measure against the success metric before declaring done.

**Prevention:** Build the integration/rollout/edge work into the plan from the start (it's not "extra"), and define "done" explicitly so the finish line is unambiguous.

---

### S6. A project you led failed to deliver its goal

**Approach:** Extreme ownership — look at what *you* could have done, then extract lessons.

**Diagnose:** Run a blameless retro: where did it actually go wrong — unclear goal, missed risk, bad estimate, seam failure? Use 5-whys on the root cause.

**Communicate:** Own the outcome publicly without blaming individuals or other teams. Present what happened, the root cause, and what changes.

**Resolve:** Salvage what's valuable, decide whether to re-plan or stop, and capture concrete action items with owners.

**Prevention:** Feed the lessons into how you run the next project — e.g., earlier risk surfacing, clearer success metric, explicit seam ownership — so the failure compounds into capability, not repetition.
