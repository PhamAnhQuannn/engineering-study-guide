# Incident Response — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Prod down, debugging unknown systems, on-call.

Each prompt frames a real fork in the road during or around an incident. Give the reasoned recommendation, then state **what would change the answer** — interviewers want to see that your call is conditional on the situation, not dogma.

---

### D1. Roll back vs. roll forward (hotfix)

**Context:** Checkout error rate jumped from 0.1% to 18% nine minutes after a deploy that went out 20 minutes ago.

- **A — Roll back the deploy.** Most reversible, best-understood, fastest path to a known-good state.
- **B — Roll forward with a hotfix.** Keep the new code, patch the bug.
- **C — Investigate first, decide later.**

**Recommendation:** **A, roll back now.** The timeline correlation is strong, the action is reversible, and it restores a state you've already validated in prod. Diagnose *after* the bleeding stops. C is wrong while customers are failing checkout — you're optimizing certainty over impact.

**What would change the answer:** Roll *forward* if the deploy included a forward-only DB migration the new code depends on (rolling back the code would break against the migrated schema), or if data has already been written in a new format the old code can't read. Then the safest mitigation is often a **feature flag** disabling the broken path while old and new code coexist.

---

### D2. How loud to declare severity when impact is ambiguous

**Context:** Error rate is elevated but you're not sure if it's 2% of users or 40%.

- **A — Declare SEV1, page leadership, open status page.**
- **B — Declare SEV3, investigate quietly, upgrade if needed.**
- **C — Declare SEV2 and reassess in 10 minutes.**

**Recommendation:** **Declare high (SEV1/SEV2) and downgrade later.** Under-calling is the asymmetric risk: a few people woken unnecessarily costs goodwill; a real SEV1 handled as a SEV3 costs revenue and trust, and you lose the early minutes that matter most. Set an explicit reassessment checkpoint.

**What would change the answer:** If you have a *reliable* impact metric showing it's genuinely a single tenant with a workaround, SEV3 is honest. Severity should track measured blast radius — but when the metric is missing, default up.

---

### D3. Keep debugging vs. escalate / wake more people

**Context:** You're on-call, 45 minutes in, still don't know the cause, customers still impacted.

- **A — Keep going solo; you're close.**
- **B — Escalate now: page the IC and the service owner.**
- **C — Escalate only if not solved in another 30 min.**

**Recommendation:** **B, escalate now.** "I'm close" 45 minutes into a customer-impacting incident is a sunk-cost trap. Escalation is not failure; it's the job. A fresh expert and a dedicated IC change the slope of the curve. Senior engineers escalate *early and without ego*.

**What would change the answer:** If impact is already mitigated (SLO restored) and you're only chasing root cause, there's no urgency — investigate solo during business hours.

---

### D4. Auto-rollback on health-check failure vs. human-in-the-loop

**Context:** Designing the deploy pipeline. Should a failed post-deploy health check auto-revert?

- **A — Fully automatic rollback.**
- **B — Auto-rollback for canary/single-region only; human gate for full fleet.**
- **C — Always require a human to click revert.**

**Recommendation:** **B.** Auto-rollback on a **canary** (small blast radius) is excellent — it catches bad deploys before they reach everyone with no human latency. Fully-automatic fleet-wide rollback can *flap* (deploy → fail → revert → re-deploy) and can fire on a false-positive health check, turning a non-incident into one. Gate the wide action.

**What would change the answer:** If health checks are extremely high-signal and rollbacks are idempotent and cheap, lean toward A for speed. If deploys are rare and high-stakes, lean toward C.

---

### D5. Shed load / degrade vs. scale up

**Context:** A traffic spike (or retry storm) is saturating the service; p99 latency is climbing and errors are rising.

- **A — Scale out (add instances).**
- **B — Shed load: rate-limit, drop low-priority traffic, serve degraded/cached responses.**
- **C — Open circuit breakers to the struggling downstream.**

**Recommendation:** **Usually B + C first, then A.** If the cause is a retry storm or a slow downstream, adding capacity can *feed* the cascade, and scaling takes minutes you don't have. Shedding load and breaking circuits stops the amplification immediately and is reversible. Scale out in parallel for the legitimate traffic.

**What would change the answer:** If it's genuine organic demand (a marketing event, not a retry loop) and the service is healthy but under-provisioned, A is the right primary lever — ideally via pre-configured autoscaling.

---

### D6. Communicate uncertainty vs. wait until you know

**Context:** 12 minutes into a SEV1, no confirmed cause yet. Send a customer/exec update now?

- **A — Send now: "We're aware, investigating, next update in 15 min."**
- **B — Wait until you have a cause and an ETA.**

**Recommendation:** **A, communicate early with honest uncertainty.** Silence reads as "they don't even know it's broken." A crisp "aware / investigating / next update at HH:MM" buys trust and stops duplicate reports and people DMing responders. You commit to a *cadence*, not to an ETA you can't yet give.

**What would change the answer:** The only adjustment is *channel*: for a single affected enterprise customer, a direct message from the account owner beats a public status banner that alarms unaffected users.

---

### D7. Trust the dashboard vs. trust the customer report

**Context:** A key customer says checkout is broken. Your dashboards are green.

- **A — Trust the dashboards; ask the customer to retry.**
- **B — Assume a monitoring blind spot and dig in.**

**Recommendation:** **B.** "Green dashboards + real user pain" almost always means a **monitoring gap** — you measure server-side success but the failure is client-side, region-specific, on an uninstrumented path, or at a CDN edge. Reproduce from the user's path, then add the missing SLI so it's never green-during-an-outage again.

**What would change the answer:** If it's reproducibly a client-side issue (their ad-blocker, corporate proxy, old app version) confirmed by tracing the specific request, then it's their environment — but you only earn that conclusion by *looking*.

---

### D8. Write a runbook vs. just move on

**Context:** Post-incident, you can write a runbook for this failure mode or return to feature work.

- **A — Write the runbook + add an alert.**
- **B — Skip it; it was a one-off.**

**Recommendation:** **A, if there's any chance of recurrence or if mitigation required tribal knowledge.** A runbook turns a 40-minute panicked diagnosis into a 5-minute copy-paste for whoever is on-call next — possibly a junior at 3 a.m. Pair it with an alert so the failure is *detected* faster too.

**What would change the answer:** If the root cause is being permanently eliminated this sprint (the failure mode will no longer exist), skip the runbook and just track the fix.
