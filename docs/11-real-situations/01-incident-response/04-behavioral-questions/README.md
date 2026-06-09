# Incident Response — Behavioral (STAR) Questions

[← Topic overview](../README.md)

> Topic: Prod down, debugging unknown systems, on-call.

Senior behavioral prompts about incidents. Use **STAR** (Situation, Task, Action, Result). For each, "what good looks like" lists the signals an interviewer scores; the sample answer is a concise, concrete model. Quantify impact and always close with a *learning/prevention* beat.

---

### B1. Tell me about a time you led the response to a major production incident.

**What good looks like:** You took the IC role (process, not just the fix), mitigated before diagnosing, communicated on a cadence, and ran a blameless postmortem with real action items. Ownership tone, not blame.

**Sample answer:**
- **S:** Checkout was failing for ~25% of users during a Friday peak; ~$X/min in lost orders.
- **T:** I was on-call and took incident command.
- **A:** I declared SEV1, named a comms lead and a scribe, and posted a status update committing to 15-minute cadence. The deploy log showed a release 12 minutes before the error elbow, so I rolled it back without waiting to prove causation. Errors dropped within 4 minutes. I then traced the bug calmly: the release held DB connections across a slow payment-processor call and starved the pool.
- **R:** MTTR was ~11 minutes. In the blameless postmortem we added a pool-saturation alert, a load test for the slow-processor path, and a review rule against holding connections across network I/O. That class of incident hasn't recurred.

---

### B2. Describe a time you had to debug a system you didn't understand.

**What good looks like:** Structured approach (signals, "what changed," dependency graph) over random guessing; humility to escalate; learning the system as you go.

**Sample answer:**
- **S:** I got paged for a legacy billing service no one on my team owned.
- **T:** Restore it; I had zero context.
- **A:** I started from the golden signals and the change log rather than the code. Errors spiked with no deploy, so I walked the dependency chain and found a downstream tax API returning slow 5xxs. I added a circuit breaker with a cached fallback to mitigate, then pulled in the original owner to confirm the fix was safe.
- **R:** Service recovered in ~20 minutes. I wrote the first runbook this service ever had, which a junior used two weeks later to resolve a similar page in 5 minutes.

---

### B3. Tell me about a time you made the wrong call during an incident.

**What good looks like:** Honesty, fast recovery from the mistake, choosing reversible actions, and a concrete lesson. No blaming others.

**Sample answer:**
- **S:** During an outage I was convinced it was a network issue and spent ~15 minutes chasing the LB.
- **T:** Find and fix the cause.
- **A:** I was anchoring on the least-instrumented layer to avoid suspecting my team's recent config change. When a teammate asked "what changed?", I checked and found we'd shipped a config flip an hour earlier. I reverted it and it recovered. I owned the misdirection in the postmortem.
- **R:** MTTR was longer than it should have been (~25 min). The lesson — *always check your own recent changes first* — became a literal first step in our incident runbook, and I now timebox any single hypothesis to 10 minutes before re-checking the change log.

---

### B4. Describe an incident where communication mattered more than the fix.

**What good looks like:** You separated comms from response, managed stakeholders/customers, and prevented panic — recognizing that trust is part of the outcome.

**Sample answer:**
- **S:** A partial outage hit one enterprise customer mid-contract-renewal.
- **T:** Resolve it, but also protect the relationship.
- **A:** The fix took ~40 minutes, but I appointed a comms lead immediately who gave the customer's technical contact direct, honest updates every 15 minutes — impact, what we knew, what we were doing, next update time — instead of a generic status banner. Engineering stayed heads-down.
- **R:** We resolved it, and the customer's lead later told our account team the *transparency* during the incident was why they renewed. We standardized "dedicated comms lead for any customer-facing SEV" after that.

---

### B5. Tell me about a time you reduced on-call pain / improved reliability for your team.

**What good looks like:** You treated toil and alert fatigue as real problems, used data, and made a systemic change — not a hero fix.

**Sample answer:**
- **S:** Our team's pager was firing 30+ times/week, mostly noise; people were burning out and ignoring alerts.
- **T:** Cut the noise without missing real incidents.
- **A:** I pulled a month of alert data, found 70% came from three flapping, non-actionable alerts. I retuned them to alert on sustained SLO burn instead of raw gauges, deleted two, and attached runbooks to the rest. I also added auto-remediation for one recurring restart.
- **R:** Pages dropped ~80%, MTTA improved because real pages weren't drowned, and the team's on-call satisfaction score went up measurably. No real incidents were missed in the following quarter.

---

### B6. Describe a postmortem you ran and what changed because of it.

**What good looks like:** Blameless framing, root cause (not symptom), action items with owners and deadlines, and follow-through.

**Sample answer:**
- **S:** A schema migration locked a large table and caused a 15-minute write outage.
- **T:** Run the retro and make sure it never happens again.
- **A:** I ran it blamelessly — focused on why our process *allowed* a locking migration to reach prod, not on the engineer who wrote it. Root cause via 5 Whys: we had no migration-safety review and no lock-budget tooling. I logged action items with named owners: a migration-safety checklist, a CI check flagging destructive/locking operations, and a guideline for online schema-change tooling.
- **R:** All three shipped within the sprint. We've run dozens of migrations since with zero lock-induced outages, and the CI check has caught two risky migrations before deploy.

---

### B7. Tell me about a time you had to decide between rolling back and pushing forward under pressure.

**What good looks like:** Reasoning about reversibility and state, not just speed; clear decision under uncertainty.

**Sample answer:**
- **S:** A release broke a feature, but it had already run a forward-only data migration that the new code depended on.
- **T:** Restore service without corrupting data.
- **A:** A plain rollback would have left old code reading a migrated schema, risking worse corruption. So instead of reverting, I disabled the broken feature behind a flag (small blast radius, fully reversible), kept the migrated state intact, and shipped a targeted hotfix during business hours.
- **R:** Customer impact stopped within minutes, no data was corrupted, and we added "is this migration reversible?" as a required field on every deploy checklist.
