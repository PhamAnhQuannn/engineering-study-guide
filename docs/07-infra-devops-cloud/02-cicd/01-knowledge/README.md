# CI/CD & Deploys — Knowledge / Study Notes

> Topic: Pipelines, blue-green, canary, rollback.

[← Topic overview](../README.md)

CI/CD is the automation that turns a commit into running production software safely and repeatedly. Senior signal is less about which tool and more about **what guarantees the pipeline gives you** and **how you deploy without taking down users**.

---

## 1. CI vs CD vs CD

- **Continuous Integration (CI):** every push triggers automated build + test on a shared mainline, so integration problems surface in minutes, not at release. Prerequisite: small, frequent merges and a fast, reliable test suite.
- **Continuous Delivery (CD):** every change that passes CI is *deployable* — artifacts are built, tested, and parked one button-press from production.
- **Continuous Deployment (CD):** the same but production deploys happen **automatically** on green. Requires strong tests, observability, and fast rollback.

They form a ladder: you can't do continuous deployment without trustworthy CI underneath.

---

## 2. Pipeline anatomy

A typical pipeline is a DAG of stages, each gating the next:

```
checkout → lint/static analysis → build → unit tests → package (artifact/image)
   → integration tests → security scan (SAST/deps) → publish artifact
   → deploy to staging → smoke/e2e → deploy to prod (gated) → post-deploy checks
```

Core principles:
- **Build once, promote the same artifact.** The immutable artifact (jar, binary, container image) built early is the *exact* thing promoted through staging → prod. Rebuilding per environment risks "works in staging, breaks in prod".
- **Fail fast & cheap.** Order stages cheapest-and-most-likely-to-fail first (lint → unit → integration → e2e). Parallelize independent jobs.
- **Hermetic, reproducible builds.** Pinned dependencies, pinned base images, no network surprises. Cache deps but invalidate correctly.
- **Idempotent, automated deploys.** No manual SSH steps. The pipeline is the only path to prod (auditable, repeatable).
- **Trunk-based + short-lived branches** keep CI meaningful; long branches defeat "continuous integration."

**Artifacts & registries:** images go to a container registry (ECR/GCR/Docker Hub); versioned by immutable digest, not mutable `latest`.

---

## 3. Deployment strategies

The question is always: *how do you replace running version A with B without an outage and with a fast undo?*

### Recreate (big bang)
Stop A, start B. Simple, but causes downtime and has no instant rollback. Acceptable only for non-critical/internal systems.

### Rolling update
Replace instances in batches (e.g., 25% at a time). No extra fleet cost, no downtime if the app is backward-compatible. Default in Kubernetes Deployments (`maxSurge`/`maxUnavailable`). Downsides: A and B run **simultaneously** (must be compatible), and rollback means rolling *back*, which is slow.

### Blue-Green
Stand up a full parallel environment (green) running B alongside live (blue) running A. Smoke-test green, then **flip the router/load balancer** to green. Rollback = flip back instantly. Pros: instant cutover and rollback, test prod-like before traffic. Cons: ~2× infrastructure during the window; database/schema must be compatible with both; in-flight sessions/connections need draining.

### Canary
Route a **small % of real traffic** (1% → 5% → 25% → 100%) to B, watching error rate / latency / business metrics at each step. Automated canary analysis promotes or aborts. Pros: limits blast radius, catches issues only real traffic reveals. Cons: needs good metrics + traffic-splitting (service mesh/LB/feature flag) and enough traffic to be statistically meaningful.

### Feature flags / dark launch
Deploy code dark (off), then toggle on for cohorts at runtime — **decouples deploy from release.** Enables instant kill-switch without redeploying. Pairs with canary (flag-based % rollout). Watch for flag debt.

| Strategy | Downtime | Rollback speed | Extra cost | Blast radius |
|---|---|---|---|---|
| Recreate | Yes | Slow (redeploy) | None | Full |
| Rolling | No | Medium | None | Growing |
| Blue-Green | No | Instant (flip) | ~2× temporarily | Full at cutover |
| Canary | No | Fast (shift traffic) | Small | Tiny → full |

---

## 4. Rollback & safety

- **Rollback must be a first-class, rehearsed operation**, not an improvisation. Keep the previous artifact ready; prefer **roll back** over roll forward when prod is actively broken.
- **Backward/forward compatibility** is what makes safe deploys possible: a new app version must work with the old DB schema (and vice versa) because both run during a rollout. This drives the **expand/contract (parallel-change) migration pattern**: add column → deploy code writing both → backfill → deploy code reading new → drop old. Never deploy code and a destructive migration together.
- **Database migrations** are the hardest part of rollback because data changes aren't trivially reversible. Make migrations additive and decoupled from deploys.
- **Smoke tests + health checks** after deploy; **automated rollback** if SLOs breach within a monitoring window.
- **Deploy markers** in observability so you can correlate a metric spike with the exact release.

---

## 5. Quality & security gates

- **Test pyramid in CI:** many fast unit tests, fewer integration, fewest e2e. Flaky tests erode trust — quarantine and fix them.
- **Static analysis / SAST**, dependency/vuln scanning (SCA), license checks, container image scanning.
- **Secrets** come from the CI secret store / vault, never the repo; scope tokens with least privilege; short-lived OIDC credentials over long-lived keys.
- **Required checks / branch protection** so nothing merges red.
- **Supply-chain:** pin actions/images by digest, generate SBOMs, sign artifacts (Sigstore/cosign), provenance (SLSA) for high-assurance.

---

## 6. Key metrics (DORA)

- **Deployment frequency** — how often you ship.
- **Lead time for changes** — commit → production.
- **Change failure rate** — % of deploys causing incidents.
- **MTTR** — time to restore service.

Elite teams deploy frequently *and* have low failure rate + fast recovery — small batches + fast rollback are how you get both.

---

## Common pitfalls & misconceptions

- "CD means deploying constantly is risky." Small, frequent, reversible deploys are *safer* than big quarterly releases.
- Rebuilding artifacts per environment instead of promoting one immutable build.
- Coupling a destructive DB migration to the same release as the code — kills rollback.
- Canary without enough traffic or without metrics — it's just a slow rollout that catches nothing.
- Blue-green while ignoring that the shared DB must serve both versions.
- Treating flaky tests as noise; they hide real failures and train people to ignore red.
- Manual deploy steps that aren't in the pipeline — un-auditable and unrepeatable.

---

## What interviewers probe

- Difference between continuous delivery and deployment.
- Blue-green vs canary vs rolling and when each fits.
- How you roll back, especially with a DB schema change involved (expand/contract).
- How you decouple deploy from release (feature flags).
- What makes a pipeline trustworthy (build-once, fast feedback, gates).
- DORA metrics and what they tell you.
- Handling secrets and supply-chain security in CI.

---

## Quick-reference summary

- **CI** = integrate+test every change; **CDelivery** = always deployable; **CDeployment** = auto-ship on green.
- **Build once, promote the immutable artifact** through environments.
- **Strategies:** recreate (downtime), rolling (no extra cost), blue-green (instant flip, 2× cost), canary (small blast radius, needs metrics).
- **Feature flags decouple deploy from release** and give a kill switch.
- **Safe rollback needs backward-compatible code + additive migrations (expand/contract).**
- **Gate** with tests, SAST/SCA, secret hygiene, required checks; measure with **DORA**.
