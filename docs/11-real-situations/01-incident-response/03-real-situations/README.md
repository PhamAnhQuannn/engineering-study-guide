# Incident Response — Real-World Situations

[← Topic overview](../README.md)

> Topic: Prod down, debugging unknown systems, on-call.

On-the-job scenarios. For each, work the senior loop: **model the approach & mitigate → diagnose with data → communicate → root-cause fix → prevention.** The point is to show you stop the bleeding before chasing the cause, and that you close the loop afterward.

---

### S1. The 2 a.m. SEV1: checkout is down, you've never seen this service

**Scenario:** You're secondary on-call, paged because primary didn't ack. Payments API is returning 500s for ~30% of checkouts. You barely know this service.

- **Mitigate first:** Declare SEV1, become IC, page primary + service owner. Pull the deploy/flag/config timeline — *what changed in the last hour?* If a deploy lines up with the error elbow, roll it back immediately. If a feature flag was flipped, flip it back. You don't need to understand the bug to revert it.
- **Diagnose with data:** Golden signals on the payments service. Errors up + latency up + DB connection pool saturated → the app is starving on DB connections. Trace one failing request: it's blocked acquiring a connection. Connection count spiked right when the new release doubled the pool checkout time.
- **Communicate:** Status page: "Some checkouts failing, investigating, update in 15 min." Exec one-liner: impact %, mitigation in progress, next update time. Scribe timestamps every action.
- **Root-cause fix:** New code held a DB connection across a slow external call (held the connection while waiting on a payment processor). Fix: acquire the connection *after* the external call, or use a separate pool. Add a max-checkout-time guard.
- **Prevention:** Connection-pool saturation alert; load test that exercises the slow-processor path; a runbook ("payments 500s → check pool saturation → roll back release N"); lint/review rule against holding DB connections across network I/O.

---

### S2. Latency cliff with no deploy

**Scenario:** p99 on the API tripled over 40 minutes. No deploy, no flag change. Error rate is fine, just slow.

- **Mitigate:** No obvious revert target, so contain impact: enable aggressive caching / serve slightly stale data on the hot read path; scale out app tier to absorb the queue; if a specific endpoint is the culprit, rate-limit or shed it.
- **Diagnose:** Latency up + saturation up + traffic *flat* = a leak or a slow dependency, not load. Check DB: a query that was fast is now doing a full table scan — a background job deleted statistics / a table crossed a size threshold and the planner flipped to a bad plan. Or: a downstream dependency quietly degraded (check its dashboards / status page).
- **Communicate:** SEV2, internal channel, customers see degradation not outage. Update stakeholders that it's perf, not data-loss.
- **Root-cause fix:** Re-run `ANALYZE` / add the missing index / pin the plan; or fail over off the degraded dependency.
- **Prevention:** Alert on plan regressions / slow-query growth; query-latency SLOs per endpoint; auto-ANALYZE; circuit breaker + fallback for the flaky dependency.

---

### S3. Green dashboards, angry customer

**Scenario:** Your biggest customer escalates: their users can't log in. Every dashboard is green.

- **Mitigate:** Don't dismiss it. Reproduce from *their* path — their region, their browser, their tenant config. If it's reproducible and severe, declare an incident even though metrics are green.
- **Diagnose:** Trace a real failing login by request ID. Turns out auth succeeds server-side (hence green) but a new Content-Security-Policy header you shipped blocks a script their SSO flow depends on — a client-side failure your server-side SLIs never saw.
- **Communicate:** Direct line to that customer (not a public banner — others are fine). Honest: "We found it, here's the ETA."
- **Root-cause fix:** Adjust the CSP to allow the required origin; ship and verify from their path.
- **Prevention:** Synthetic/RUM monitoring that catches client-side failures; treat CSP changes as high-risk with a canary; an SLI that measures *end-to-end login success*, not just the server response.

---

### S4. The retry storm cascade

**Scenario:** A downstream recommendations service hiccups for 30 seconds. Now your whole API is timing out and won't recover even though recommendations came back.

- **Mitigate:** Recognize the signature — traffic *to* a service rising while its success rate falls = clients retrying. Break the loop: disable retries to recs, open a circuit breaker, serve a default/empty recs response (graceful degradation). The page works without recommendations.
- **Diagnose:** Thread pools / connection pools were exhausted by piled-up retries to the slow dependency; legitimate traffic couldn't get a thread. Classic cascading failure amplified by un-jittered, unbounded retries.
- **Communicate:** SEV1 while the cascade runs; note that recs is degraded but core flow restored.
- **Root-cause fix:** Bound retries, add jittered exponential backoff, add a circuit breaker with a fallback, and isolate the recs call (bulkhead / separate pool) so it can't starve everything.
- **Prevention:** Chaos drill killing a dependency; default-degraded UX for every non-critical dependency; alert on retry-rate, not just error-rate.

---

### S5. The data-corruption scare

**Scenario:** Support reports a few customers see *someone else's* order in their history. Possible cross-tenant data leak.

- **Mitigate:** This is potentially a security/privacy SEV1. Contain blast radius *before* diagnosing: if the affected code path can keep leaking, disable that feature/endpoint via kill switch. Do **not** take irreversible actions (don't delete/patch data blindly).
- **Diagnose:** Trace one bad response. Find a caching layer keyed without the tenant ID — a recent change added a cache that omits `tenant_id` from the key, so cache hits cross tenants. Quantify exposure: which records, how many users, what window.
- **Communicate:** Loop in security/legal early (disclosure obligations). Affected customers get a direct, honest notice. Exec update with scope.
- **Root-cause fix:** Add tenant ID to the cache key, flush the poisoned cache, verify isolation.
- **Prevention:** Make tenant scoping a non-optional part of the cache abstraction; add a test that asserts cross-tenant isolation; review checklist for any caching change; consider row-level security as defense in depth.

---

### S6. The flapping service and the noisy pager

**Scenario:** A service alerts, recovers, alerts again all night. On-call is exhausted and starting to ignore pages.

- **Mitigate:** Stop the bleeding *for the humans*: temporarily silence the flapping alert (with an expiry + a tracking ticket) so the real signal isn't drowned. Apply a holding mitigation — e.g., bump a too-tight timeout, add a small buffer, or pin to a known-good instance.
- **Diagnose:** Flapping usually means the alert threshold sits right at the system's normal operating edge, or there's a periodic spike (a cron job, GC pause, a noisy neighbor). Correlate the flap timing with periodic events.
- **Communicate:** Tell the team why the alert is silenced and when it'll be revisited — silent silencing erodes trust.
- **Root-cause fix:** Fix the underlying spike (tune GC / stagger the cron / fix the resource limit) **and** fix the alert (symptom-based, with sustained-duration windows, alerting on SLO burn not a raw gauge).
- **Prevention:** Alert hygiene review; every alert must be actionable and link a runbook; track alert-noise as a metric; budget time to delete/retune bad alerts.
