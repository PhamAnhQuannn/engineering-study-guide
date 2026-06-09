# CI/CD & Deploys — Practice Questions

> Topic: Pipelines, blue-green, canary, rollback.

[← Topic overview](../README.md)

---

### Q1. Distinguish continuous integration, continuous delivery, and continuous deployment.

**Answer:** **CI** merges and automatically builds + tests every change on a shared mainline, catching integration issues early. **Continuous delivery** extends this so every green change is *deployable* — a tested artifact sits one approval from prod. **Continuous deployment** removes the manual approval: green changes go to production automatically. They build on each other; you need solid CI before delivery, and strong tests + observability + fast rollback before automated deployment.

---

### Q2. Explain blue-green deployment to a junior, including its main cost.

**Answer:** You run two identical production environments: "blue" serves live traffic on version A; you deploy version B to "green" and test it while no users touch it. When green looks good, you flip the load balancer to point at green. If something breaks, you flip back instantly — that's the big win, near-zero-downtime cutover and instant rollback. The main cost is needing roughly double the infrastructure during the cutover window, plus the shared database must work with both A and B since the flip is all-or-nothing.

---

### Q3. What is a canary deployment and what does it require to be useful?

**Answer:** A canary routes a small percentage of *real* production traffic to the new version (say 1% → 5% → 25% → 100%), watching error rate, latency, and business metrics at each step before widening. It limits blast radius — a bad release hurts 1% of users, not everyone. To be useful it needs: traffic-splitting (load balancer, service mesh, or feature flag), good real-time metrics, automated analysis/abort criteria, and enough traffic volume for the metrics to be statistically meaningful.

---

### Q4. Why should a pipeline "build once and promote the same artifact"?

**Answer:** If you rebuild for each environment, the staging artifact and the prod artifact aren't byte-identical — different dependency versions, build-time state, or base images can sneak in, so "passed in staging" doesn't guarantee prod. Building one immutable artifact (a container image by digest, a versioned binary) and promoting *that exact thing* through staging → prod means what you tested is what ships. It also makes rollback trivial: redeploy the prior known-good artifact.

---

### Q5. You need to add a NOT NULL column and ship new code that uses it. How do you do this without breaking rollback?

**Answer:** Use the **expand/contract (parallel-change)** pattern, decoupling schema from code releases:
1. Expand: add the column as nullable (or with a default), deploy — old code ignores it.
2. Deploy code that writes the new column (dual-write), backfill existing rows.
3. Deploy code that reads the new column.
4. Once everything depends on it and is stable, add the NOT NULL constraint.
5. Contract: later, drop any old column.

At every step, the previous app version still works against the current schema, so you can roll back the code without the DB being incompatible. Never ship a destructive migration in the same release as the code that depends on it.

---

### Q6. When prod is actively broken after a deploy, do you roll back or roll forward?

**Answer:** Default to **roll back** — restore the last known-good artifact to stop user impact fast; MTTR matters more than elegance during an incident. Roll *forward* only when rollback is impossible (e.g., an irreversible migration already ran) or the fix is trivial and faster than a rollback. This is why deploys are designed to be reversible (immutable artifacts, additive migrations, feature flags) in the first place.

---

### Q7 (MCQ). Which deployment strategy gives the *smallest blast radius* for a bad release?

A. Recreate  B. Rolling  C. Blue-green  D. Canary

**Answer: D.** Canary exposes only a small slice of real traffic to the new version, so a defect affects the fewest users before automated analysis aborts the rollout.

---

### Q8 (MCQ). In a rolling update, both old and new versions run at the same time. What must therefore be true?

A. The database must be down during the rollout  
B. The new and old versions must be mutually compatible (API + schema)  
C. You need double the infrastructure  
D. Canary analysis is mandatory

**Answer: B.** Because A and B serve traffic concurrently, they must be backward/forward compatible — same reason expand/contract migrations exist. (Double infra is blue-green; canary analysis is optional.)

---

### Q9 (MCQ). Which of the DORA metrics measures how long it takes to restore service after a failure?

A. Deployment frequency  B. Lead time for changes  C. MTTR  D. Change failure rate

**Answer: C.** MTTR (mean time to restore) captures recovery speed; low MTTR is what makes frequent deploys safe.

---

### Q10. What do feature flags add on top of a deployment strategy?

**Answer:** They **decouple deploy from release.** Code can ship to production "dark" (flag off) and be turned on later for specific cohorts or a percentage of users at runtime — no redeploy needed. Benefits: instant kill-switch if something misbehaves, gradual/targeted rollout independent of the binary, and the ability to test in prod with internal users. The cost is flag debt: stale flags accumulate and must be cleaned up, and untested flag combinations can create surprising states.

---

### Q11. Why are flaky tests a serious problem in a CI pipeline, and how do you handle them?

**Answer:** Flaky tests fail intermittently without a real code defect. They erode trust — people start re-running until green or ignoring red, which means a genuinely broken build can slip through. They also slow everyone via retries. Handling: detect flakiness (track pass/fail history), **quarantine** flaky tests out of the blocking set so they don't gate merges, then fix root causes (timing/ordering/shared-state/network nondeterminism). The goal is a green build that *means something*.

---

### Q12. How should CI handle secrets and credentials?

**Answer:** Never store secrets in the repo. Inject them from the CI provider's encrypted secret store or a vault at runtime, scoped with least privilege and short-lived where possible (prefer OIDC-federated, ephemeral cloud credentials over long-lived static keys). Mask them in logs, don't expose them to PRs from forks, and rotate on a schedule or on suspected leak. Add pre-commit/CI secret scanning to catch accidental commits.
