# CI/CD & Deploys — Real-World Situations

> Topic: Pipelines, blue-green, canary, rollback.

[← Topic overview](../README.md)

On-the-job scenarios. Each: **approach → diagnose with data → communicate → root-cause fix → prevention.**

---

### Situation 1 — Error rate spikes to 8% two minutes after a deploy

**Approach:** Stop the bleeding first; diagnose after. Treat the recent deploy as the prime suspect.

**Diagnose:** Look at the deploy marker on the error-rate/latency dashboard — does the spike line up exactly with the release? Check which endpoints, which error class (5xx vs timeouts vs auth), and whether it correlates with the new version's pods.

**Communicate:** Declare an incident, post in the channel: "Rolling back release X, errors at 8%, started at deploy time." Keep stakeholders updated.

**Root-cause fix:** Roll back to the previous known-good artifact (instant if blue-green/canary; redeploy prior image otherwise). Confirm error rate recovers. Then investigate the bad commit in staging, fix, add a test, and re-deploy via canary.

**Prevention:** Canary deploys with automated abort on error-budget burn; a post-deploy health window that auto-rolls-back; better pre-prod test coverage for the failure mode.

---

### Situation 2 — A deploy succeeded but can't be rolled back because a migration already dropped a column

**Approach:** Rollback of code is impossible because the schema is now incompatible with the old version. Must roll forward.

**Diagnose:** Confirm the destructive migration ran (migration history table). Assess current breakage — what's failing because of it.

**Communicate:** Tell the team rollback is off the table due to the irreversible migration; the plan is a forward hotfix. Set expectations on timeline.

**Root-cause fix:** Ship a forward fix that works with the new schema. If the dropped column is still needed, restore it from backup and re-add via additive migration.

**Prevention:** **Decouple migrations from code deploys** and use expand/contract: never drop a column in the same release as the code change. Destructive ops only after the column is provably unused for several releases. Add a migration-safety review/gate that flags destructive operations.

---

### Situation 3 — CI pipeline went from 8 minutes to 40 minutes over a quarter; developers are frustrated

**Approach:** Slow CI silently kills velocity. Measure where the time goes before optimizing.

**Diagnose:** Break down stage timings. Common culprits: serial jobs that could parallelize, no dependency caching, rebuilding unaffected projects, an exploding e2e suite, undersized runners. Look at the critical path of the DAG.

**Communicate:** Share the breakdown; set a target (e.g., back under 15 min) and treat it as real work, not background chores.

**Root-cause fix:** Parallelize independent jobs; cache dependencies and Docker layers; use affected-target builds in the monorepo so only changed projects run; split/quarantine slow e2e to post-merge; right-size runners. Build-once-promote to avoid rebuilds.

**Prevention:** Add a CI-duration SLO and alert on regressions; budget pipeline time as a tracked metric; review new tests for cost.

---

### Situation 4 — Intermittent CI failures: ~1 in 5 builds fails, but re-running passes

**Approach:** Classic flakiness. The danger is people learning to "just re-run," which hides real failures.

**Diagnose:** Collect failure history to identify *which* tests flake and the pattern (timing, test ordering/shared state, external network calls, race conditions, non-deterministic data/time). Reproduce by running the suspect tests repeatedly / in random order.

**Communicate:** Make flakiness visible (dashboard of flaky tests); set a norm that re-running isn't a fix.

**Root-cause fix:** Quarantine flaky tests out of the blocking gate, then fix roots: stub external calls, control time/randomness, isolate shared state, add proper waits instead of sleeps. Return them to the gate once stable.

**Prevention:** Hermetic tests (no real network), deterministic clocks/seeds, test isolation, automated flaky-test detection that quarantines on a threshold.

---

### Situation 5 — A secret was printed in CI logs of a public PR build

**Approach:** Assume the secret is compromised the instant it appeared in a readable log.

**Diagnose:** Find which job/step logged it and why masking failed (often a secret passed to a sub-process that echoed it, or built from fragments the masker didn't recognize). Check if the PR was from a fork (forks shouldn't get secrets at all).

**Communicate:** Notify security; rotate immediately.

**Root-cause fix:** Rotate the credential now. Scrub/expire the logs. Stop exposing secrets to fork PRs (most providers withhold them by default — re-enable that). Ensure masking covers the value and its components.

**Prevention:** Least-privilege, short-lived OIDC credentials instead of static keys; never expose secrets to untrusted PRs; log-scanning for secret patterns; gate that fails if a known secret pattern appears in output.

---

### Situation 6 — Blue-green cutover worked, but users got logged out / saw errors at the flip

**Approach:** The instantaneous router flip dropped in-flight work.

**Diagnose:** Check for non-drained connections (long requests/websockets killed mid-flight), session affinity that broke when traffic moved environments, or the new version reading sessions the old wrote in an incompatible format.

**Communicate:** Note the cutover-time blip in the incident log; reassure it's transient and being addressed for next time.

**Root-cause fix:** Add **connection draining / graceful shutdown** so in-flight requests complete before the old environment is retired. Make sessions environment-agnostic (shared session store, compatible serialization). Drain websockets with reconnect.

**Prevention:** Standardize graceful-shutdown and drain timeouts in the deploy process; pre-cutover smoke tests that exercise session continuity; consider canary so the transition is gradual rather than a hard flip.

---

### Situation 7 — A dependency CVE is flagged; the security scan now fails every build, blocking all deploys

**Approach:** Balance unblocking the team against not shipping a real vulnerability.

**Diagnose:** Triage the CVE: is the vulnerable code path actually reachable in your usage? Severity, exploitability, is a patched version available? Distinguish "must fix now" from "false positive / not exploitable in context."

**Communicate:** State the risk assessment and plan; don't silently disable the scanner.

**Root-cause fix:** Bump to the patched version (or a safe transitive override). If no fix exists and it's not exploitable in your context, add a *time-boxed, documented* suppression with an owner and expiry — not a blanket disable.

**Prevention:** Automated dependency updates (Renovate/Dependabot) so you're rarely far behind; a policy that gates only on severity above a threshold; periodic review of suppressions so they don't become permanent.
