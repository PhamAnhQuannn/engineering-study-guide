# Incident Response — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Prod down, debugging unknown systems, on-call.

> **🛒 Where we are in building ShopFast** — We just finished [Project Leadership](../../../10-senior-behavioral-and-leadership/05-project-leadership/01-knowledge/README.md), where we learned to align teams and drive decisions. Now we face the hardest real-world test: **production is on fire**. ShopFast is live on Black Friday and something is very wrong. **Next:** Once the fire is out, we face [Ship vs. Right](../../02-ship-vs-right/01-knowledge/README.md) — the everyday pressure of deadline vs. quality.

---

## Teaching arc: keeping ShopFast alive under fire

### What it is & why it matters

Incident response is the discipline of **restoring service quickly and safely when production breaks**, then learning enough to prevent recurrence. Think of it as emergency medicine for software: you triage, stabilize the patient first, then diagnose in the calm of a recovery room.

At a senior level you are judged less on whether you personally find the bug and more on whether you can **run the incident**: keep the blast radius (the scope of damage) contained, coordinate people, communicate to stakeholders, make reversible decisions under uncertainty, and drive a real Root Cause Analysis (RCA) afterward. Heroics that fix the symptom but leave the system fragile are an anti-pattern.

Why it matters in interviews: this is the topic where the gap between junior and senior engineers is most obvious. A junior debugs the live outage while customers burn. A senior stops the bleeding first, then diagnoses.

---

### A ShopFast incident: Postgres connection-pool exhaustion on Black Friday

**Context.** ShopFast runs a modular monolith backed by Postgres with PgBouncer as the connection pooler. It is 11:03 AM on Black Friday — the biggest traffic day of the year. Alerts start firing.

**Timeline**

**11:03 AM — Symptom.** PagerDuty fires a SEV 1 (Severity 1 — Critical, broad customer impact, revenue at risk): `checkout_success_rate < 95%` for 5 minutes straight. The status page monitor also fails. Slack lights up with customer complaints: "My cart keeps spinning."

**11:05 AM — Acknowledge.** The on-call engineer (Priya) acknowledges the alert and immediately posts in `#incidents`: "I'm on it, declaring SEV1. I'm taking IC (Incident Commander)." She assigns Tomas as scribe (the person timestamping every action), Jin as comms lead (owns the status page and executive updates), and keeps herself as hands-on responder.

**11:06 AM — First hypothesis: what changed?** Priya opens the deployment dashboard and overlays it on the checkout error rate graph. There was a deploy at 10:47 AM — 16 minutes before symptoms appeared. The elbow in the error rate graph lines up almost exactly. Prime suspect: the 10:47 deploy.

**11:07 AM — Mitigation attempt 1: roll back the deploy.** Before diagnosing *why* it's broken, Priya initiates a rollback of the 10:47 deploy. Jin posts to the status page: "We are aware of an issue affecting checkout. Our team is actively investigating." This is the first stakeholder update, less than five minutes after the alert.

**11:09 AM — Rollback completes. Checkout error rate... stays at 98%.** Rollback did not fix it. The hypothesis was wrong, or the damage has persisted beyond the code change.

**11:10 AM — Diagnosis: four golden signals.** With the easy mitigation exhausted, Priya starts structured diagnosis using the four golden signals — Latency, Traffic, Errors, Saturation:
- **Errors:** checkout API returning 500s at 98% rate.
- **Latency:** p99 (99th-percentile) latency on the checkout endpoint spiking to 28 seconds (normal: 400ms).
- **Traffic:** ~3× normal; expected for Black Friday.
- **Saturation:** PgBouncer dashboard shows connection pool at 100% utilization. App pods are logging `connection pool exhausted` errors.

**Finding:** The 3× traffic surge has saturated the PgBouncer connection pool. The app tier is stateless and scaled out — there are now 24 app pods instead of 8. Each pod holds up to 10 connections to PgBouncer. 24 × 10 = 240 connections attempted. PgBouncer's `max_client_conn` is set to 100. Every checkout request that needs a DB connection queues, times out after 2 seconds, and returns a 500.

**The deploy at 10:47 was a red herring** — it added a new catalog feature unrelated to checkout. The real cause was the autoscaler responding to Black Friday load, tripling the pod count, which tripled the connection demand beyond the pool limit.

**11:14 AM — Mitigation 2: emergency PgBouncer config change.** Priya raises `max_client_conn` from 100 to 300 via a config-map update. This is a reversible, low-blast-radius action — it only loosens a limit, and Postgres itself can handle up to 400 connections.

**11:16 AM — Checkout error rate drops to 2%.** Residual errors are from queued requests that already timed out. Within 90 seconds, error rate is back to baseline. Jin updates the status page: "The issue affecting checkout has been resolved. We are monitoring."

**Total customer impact window: 13 minutes of severely degraded checkout.**

**11:17 AM — Mitigation 3: add a safety cap on autoscaling.** Priya adds a temporary cap of 10 pods (instead of the previous 30-pod max) to prevent the connection pool from being overwhelmed again while a proper fix is designed. This is a **second-order mitigation** — not the root fix, but a guard while the team works.

**Post-incident (the next day) — RCA and action items.** The blameless postmortem produces:
- **Root cause:** PgBouncer `max_client_conn` was never updated as the application's autoscaling ceiling rose. The two configs drifted apart over six months of gradual growth.
- **Contributing factors:** No alert existed on PgBouncer pool utilization. No load test had been run at 3× normal traffic.
- **Action items (with owners and due dates):**
  1. Add a PgBouncer pool utilization alert at 80% (on-call rotation owner, due in 2 days).
  2. Set `max_client_conn` = `max_pods × connections_per_pod × 1.2` and wire it to the autoscaling config so they move together (platform team, due in 1 week).
  3. Run a load test at 3× peak traffic as part of the Black Friday runbook annually (engineering lead, recurring).
  4. Add a checkout MTTR (Mean Time To Recovery) dashboard to the incident command runbook (Priya, due in 3 days).

---

### How to handle it

**The two-clock model.** Every incident runs two clocks that must be *decoupled*: clock 1 is **mitigate** (stop the bleeding), clock 2 is **diagnose** (find the root cause). You do NOT need to know *why* something broke to *stop the damage*. Roll back the last deploy, flip a feature flag, shed load, raise a limit — restore the SLO (Service Level Objective — your internal reliability target, e.g. 99.9% checkout success) first, then investigate at leisure.

**Incident command structure.** Even on a 3-person team, assign *roles*, not just bodies:
- **IC (Incident Commander)** — owns the *process*, not the fix. Decides, delegates, calls severity, manages the timeline. The IC should ideally keep their hands off the keyboard.
- **Responder(s)** — run commands, form and test hypotheses.
- **Comms lead** — owns the status page, stakeholder updates, and the cadence ("update every 15 minutes even if nothing changed").
- **Scribe** — timestamps every action and decision. This is gold for the postmortem and prevents two people undoing each other's work.

**Severity levels.** Declare severity high when unsure; downgrade later. Under-calling severity is the more expensive mistake.

| SEV | Meaning | Response |
|-----|---------|----------|
| SEV1 | Critical, broad customer impact, revenue/safety | All hands, page leadership, public status |
| SEV2 | Major degradation, partial impact | On-call + IC, status page |
| SEV3 | Minor / single-customer / workaround exists | Normal hours, ticket |

**Structured diagnosis when mitigation doesn't work.**
1. **"What changed?"** Overlay the broken metric on deploy/config/flag/migration timelines. ~70% of incidents are change-induced.
2. **Four golden signals** (from Google SRE): Latency, Traffic, Errors, Saturation. They tell you *where* in the stack to look.
3. **Work the dependency graph.** Follow the request path: load balancer → app → cache → DB → downstream APIs. Check each hop.
4. **Watch for retry storms.** A slow dependency causes clients to time out and retry, multiplying load on the struggling service. Signature: traffic *to* a service rising while its success rate falls. Fix by shedding load, not adding capacity.

**The blameless postmortem.** After mitigation: a written retro focused on *systems and contributing factors*, not individuals. Core sections: timeline, customer impact, detection, root cause (often via **5 Whys** — asking "why" five times to reach the systemic cause), what went well, what went poorly, and action items with owners and due dates. Blameless does not mean accountability-free — it means we fix the *system* that let a reasonable action cause an outage.

---

### What good looks like

- You declare severity and assign roles within the first 2-3 minutes.
- Your first action is a *reversible, low-blast-radius mitigation* — not reading the code.
- You give a stakeholder update within 5 minutes of acknowledging the incident, and repeat on a fixed cadence.
- When your first hypothesis is wrong (like the rollback above), you pivot without ego and run structured diagnosis.
- Your MTTR (Mean Time To Recovery — how long until the impact stops) for this type of incident shrinks after the postmortem because you added runbooks, alerts, and config guardrails.
- The postmortem produces action items with owners and due dates. An item with no owner is a decision to have the incident again.

---

### Pitfalls

- **Debugging the live outage instead of mitigating it.** The most common interview red flag. Stop the bleeding first.
- **No IC.** Five engineers quietly trying different fixes, stepping on each other, nobody owning comms.
- **Skipping the scribe.** You can't write a real postmortem from memory, and you miss "two fixes fighting."
- **"It's probably the network."** Blaming the least-instrumented layer to avoid examining your own recent change. Check what *you* changed first.
- **Fixing the symptom, calling it done.** Restarting the box clears the memory leak but the leak ships again tomorrow. Mitigation ≠ root cause.
- **Treating the postmortem as a formality.** Action items with no owner and no deadline are scheduled re-incidents.
- **Hero culture.** Rewarding the person who stayed up 14 hours, instead of asking why the system needed a hero.
- **Alert fatigue.** So many noisy pages that the real one gets ignored. Alerts must be actionable and symptom-based — alert on the SLO, not on CPU = 80%.

---

## Core concepts

### The two clocks: mitigate first, diagnose second
Every incident runs two competing clocks: **time-to-mitigate (TTM)** and **time-to-root-cause**. The senior instinct is to decouple them. You do **not** need to understand *why* something broke to *stop the bleeding*. Roll back the last deploy, fail over to a replica, shed load, flip a feature flag — restore the SLO first, then investigate at leisure. Junior engineers invert this and debug a live outage while customers burn.

- **MTTD** — Mean Time To Detect (how long until anyone notices).
- **MTTA** — Mean Time To Acknowledge (alert fires → human owns it).
- **MTTM / MTTR** — Mean Time To Mitigate / Recover (impact stops).
- **MTBF** — Mean Time Between Failures (reliability over time).

Optimizing MTTR usually beats chasing MTBF — failures are inevitable; cheap recovery is what keeps you reliable.

### Incident command structure
Borrowed from emergency services (ICS — Incident Command System). Even in a 3-person startup you assign **roles**, not just bodies:

- **Incident Commander (IC)** — owns the *process*, not the fix. Decides, delegates, keeps the timeline, declares severity, calls when to escalate or roll back. The IC should ideally not have their hands on a keyboard.
- **Ops / Subject-matter responder(s)** — the people actually running commands and forming hypotheses.
- **Communications lead** — owns the status page, the customer/exec updates, the cadence ("update every 15 min even if nothing changed").
- **Scribe** — timestamps every action and decision in the incident channel. This is gold for the postmortem and prevents two people undoing each other's work.

In small teams one person wears several hats, but the *roles* still need naming aloud so nobody assumes someone else is doing comms.

### Severity levels
A severity matrix removes argument under stress. Typical:

| Sev | Meaning | Example | Response |
|-----|---------|---------|----------|
| SEV1 | Critical, broad customer impact, revenue/safety | Checkout down globally | All hands, page leadership, public status |
| SEV2 | Major degradation, partial impact | One region slow, one feature down | On-call + IC, status page |
| SEV3 | Minor / single-customer / workaround exists | Async job lagging | Normal hours, ticket |

Severity drives *who you wake up* and *how loudly you communicate*. When unsure, **declare high and downgrade** — under-calling severity is the more expensive mistake.

### The blameless postmortem
After mitigation, a written retro that focuses on **systems and contributing factors**, not individuals. Core sections: timeline, customer impact, detection, root cause (often via **5 Whys** or a **causal/contributing-factors** model), what went well, what went poorly, and **action items with owners and due dates**. Blameless does not mean *accountability-free* — it means we assume people acted reasonably given the information and incentives they had, and we fix the *system* that let a reasonable action cause an outage.

---

## How diagnosis works under pressure

### Bisect in time, not in code
The single most powerful question: **"What changed?"** ~70%+ of incidents are change-induced (a deploy, a config flip, a feature flag, a migration, a dependency upgrade, a cert expiry, a traffic spike). Pull up the deploy log and overlay it on the metric that broke. If the elbow in the graph lines up with a release, you have your prime suspect — mitigate by reverting it *before* you prove causation.

### Use the four golden signals to localize
From Google's SRE (Site Reliability Engineering) book, watch **Latency, Traffic, Errors, Saturation**. They tell you *where* in the stack to look:
- Errors up, latency flat → bad code path / bad dependency response.
- Latency up, saturation up (CPU/connections/threads) → resource exhaustion, need to scale or shed.
- Traffic spike → capacity / thundering herd / retry storm.
- Saturation climbing with flat traffic → a leak (memory, connections, file handles).

### Work the dependency graph
For an unknown system, follow the request path: LB (Load Balancer) → app → cache → DB → downstream APIs. Check each hop's dashboards and the **error budget** at each boundary. A latency increase at one layer often masks the *real* failure one layer deeper (e.g., app threads all blocked waiting on a slow DB query that is itself blocked on a lock).

### Retry storms and cascading failure
A classic killer: a slow downstream causes clients to time out and **retry**, which multiplies load on the already-struggling service, which slows it further. Recognize the signature (traffic *to* a service rising while its success rate falls) and break the loop: shed load, open circuit breakers, disable retries, add jittered backoff. Mitigation here is often *less* traffic, not more capacity.

---

## Key terms & definitions

- **SLI / SLO / SLA** — Service Level Indicator (a measured number, e.g. % of requests < 300 ms), Service Level Objective (the internal target, e.g. 99.9%), Service Level Agreement (the external contract with penalties). You alert on burning the SLO, not the SLA.
- **Error budget** — `1 − SLO`. The allowed amount of unreliability. Spending it fast = freeze risky changes.
- **Blast radius** — the scope of users/systems an action or failure affects. You want mitigations with small, known blast radius.
- **Runbook** — a pre-written, step-by-step recovery procedure for a known failure mode. Turns 3 a.m. panic into copy-paste.
- **Circuit breaker** — a client-side switch that stops calling a failing dependency to let it recover and to fail fast.
- **Feature flag / kill switch** — runtime toggle to disable a feature without a deploy; the fastest mitigation that exists.
- **Graceful degradation** — serving a reduced experience (cached/stale data, hidden feature) instead of an error page.
- **Toil** — manual, repetitive operational work that scales with load; the target of automation.

---

## Tradeoffs

- **Roll back vs. roll forward.** Rollback is the default because it is the most *reversible* and best-understood action. Roll forward (hotfix) when the bad state can't be undone (e.g., a schema migration already ran, or the rollback would lose data written in the new format). Never hotfix live without a way to verify and revert it.
- **Speed vs. certainty.** Acting on a strong hypothesis with a low-blast-radius, reversible mitigation beats waiting for proof. The asymmetry: a wrong-but-reversible action costs minutes; a confidently-wrong *irreversible* one (e.g., truncating a table) costs the company.
- **Communication overhead vs. focus.** Over-communicating to stakeholders steals responder attention; under-communicating erodes trust and invites more people barging into the channel. Resolve with a *dedicated comms lead* and a fixed cadence.
- **Auto-remediation vs. human judgment.** Auto-rollback / auto-scaling shrink MTTR but can mask problems or cause flapping. Guard with rate limits and "circuit breakers on the automation."

---

## Common pitfalls & misconceptions

- **Debugging the live outage instead of mitigating it.** The interview red flag. Stop the bleeding first.
- **No single IC.** Five engineers each quietly trying a different fix, stepping on each other, nobody owning comms.
- **Skipping the timeline/scribe.** You can't write a real postmortem from memory, and you lose the ability to detect "two fixes fighting."
- **"It's probably the network."** Blaming the least-instrumented layer to avoid looking at your own recent change. Check what *you* changed first.
- **Fixing the symptom, calling it done.** Restarting the box clears the memory leak but the leak ships again tomorrow. Mitigation ≠ root cause.
- **Treating the postmortem as a formality.** Action items with no owner and no deadline are decisions to have the incident again.
- **Hero culture.** Rewarding the person who stayed up 14 hours fixing it, instead of asking why the system needed a hero.
- **Alert fatigue.** So many noisy pages that the real one gets ignored (high MTTA). Alerts must be actionable and symptom-based (alert on the SLO, not on CPU=80%).

---

## What interviewers probe

- **Do you mitigate before you diagnose?** They'll describe a live SEV1 and watch whether you reach for rollback/flags or start reading code.
- **Can you run the room?** Do you assign IC/comms/scribe, set a cadence, manage stakeholders — or do you only talk about the bug?
- **Structured diagnosis.** Do you reason from signals and "what changed," or guess randomly?
- **Reversibility instinct.** Do you reach for low-blast-radius, reversible actions and avoid irreversible ones under uncertainty?
- **Communication.** Can you give a crisp exec update ("impact, what we know, what we're doing, next update at X") without jargon?
- **Learning loop.** Do you run a *blameless* postmortem and convert it into prevention (tests, alerts, runbooks, guardrails)?
- **Ownership.** Do you own the outcome even when the trigger was someone else's change or an upstream vendor?

---

## Quick-reference summary

1. **Detect → Acknowledge → Mitigate → Diagnose → Recover → Postmortem.** Mitigate and diagnose are *separate clocks*.
2. **First question: "What changed?"** Overlay the broken metric on the deploy/flag/config timeline.
3. **Stop the bleeding with reversible, low-blast-radius actions:** roll back, fail over, kill switch, shed load, open breakers.
4. **Assign roles aloud:** Incident Commander, comms lead, scribe — even on a tiny team.
5. **Declare severity high when unsure; downgrade later.** Severity drives paging and comms loudness.
6. **Watch the four golden signals** (Latency, Traffic, Errors, Saturation) to localize the failing layer.
7. **Beware retry storms / cascading failure** — sometimes the fix is *less* load.
8. **Communicate on a cadence:** impact, status, next-update time. Don't go dark.
9. **Roll back by default; roll forward only when state can't be undone.**
10. **Close the loop:** blameless postmortem → action items with owners & dates → runbooks, alerts, and guardrails so the next time is cheaper.
