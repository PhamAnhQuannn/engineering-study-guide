# Incident Response — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Prod down, debugging unknown systems, on-call.

Incident response is the discipline of restoring service quickly and safely when production breaks, then learning enough to prevent recurrence. At a senior level you are judged less on whether you personally find the bug and more on whether you can **run the incident**: keep the blast radius contained, coordinate people, communicate to stakeholders, make reversible decisions under uncertainty, and drive a real root-cause fix afterward. Heroics that fix the symptom but leave the system fragile are an anti-pattern.

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
Borrowed from emergency services (ICS). Even in a 3-person startup you assign **roles**, not just bodies:

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
From Google's SRE book, watch **Latency, Traffic, Errors, Saturation**. They tell you *where* in the stack to look:
- Errors up, latency flat → bad code path / bad dependency response.
- Latency up, saturation up (CPU/conns/threads) → resource exhaustion, need to scale or shed.
- Traffic spike → capacity / thundering herd / retry storm.
- Saturation climbing with flat traffic → a leak (memory, connections, file handles).

### Work the dependency graph
For an unknown system, follow the request path: LB → app → cache → DB → downstream APIs. Check each hop's dashboards and the **error budget** at each boundary. A latency increase at one layer often masks the *real* failure one layer deeper (e.g., app threads all blocked waiting on a slow DB query that is itself blocked on a lock).

### Retry storms and cascading failure
A classic killer: a slow downstream causes clients to time out and **retry**, which multiplies load on the already-struggling service, which slows it further. Recognize the signature (traffic *to* a service rising while its success rate falls) and break the loop: shed load, open circuit breakers, disable retries, add jittered backoff. Mitigation here is often *less* traffic, not more capacity.

---

## Key terms & definitions

- **SLI / SLO / SLA** — Indicator (a measured number, e.g. % of requests < 300 ms), Objective (the internal target, e.g. 99.9%), Agreement (the external contract with penalties). You alert on burning the SLO, not the SLA.
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
