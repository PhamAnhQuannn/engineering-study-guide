# CI/CD & Deploys — Knowledge / Study Notes

> Topic: Pipelines, blue-green, canary, rollback.

[← Topic overview](../README.md)

> **🛒 Where we are in building ShopFast** — Last topic we set up a [Git branch workflow](../../01-git/01-knowledge/README.md) so the team can collaborate safely. Now we wire that branch workflow to automation: every push triggers tests, every green build produces a deployable artifact, and every merge to `main` ships to production without downtime. **Next:** to run those deployable artifacts consistently across laptops, staging, and production, we need [Containers & Orchestration](../../03-containers/01-knowledge/README.md).

---

## Teaching arc: shipping ShopFast continuously

### What it is

**CI/CD (Continuous Integration / Continuous Delivery / Continuous Deployment)** is the automation that turns a code commit into running production software safely and repeatedly — no manual steps, no "deployment day" ceremonies.

Analogy: imagine a car assembly line. A CI/CD (Continuous Integration / Continuous Delivery) pipeline is that line. Raw materials (code) enter one end; a finished, quality-checked car (deployable artifact) rolls off the other. Every station is automated, every car passes the same quality checks, and the line runs every time a part arrives — not once a quarter.

### Why we use it

Without CI/CD the 4-person ShopFast team suffers:

- **"It works on my machine"** — without a shared build environment, what passes locally breaks in production.
- **Integration hell** — engineers who merge weekly accumulate huge diffs; conflicts are painful and risky.
- **Manual deploy anxiety** — a human SSHing into a server and running scripts is slow, un-auditable, and error-prone.
- **Slow feedback** — a bug introduced Monday isn't caught until the Friday deploy; it's now tangled with 4 days of other changes.

CI/CD solves all four: a shared, automated pipeline catches failures in minutes, every change is an integration point, the pipeline is the only path to prod, and feedback is instant.

### What it looks like

A minimal CI (Continuous Integration) pipeline (GitHub Actions syntax — applicable principle is tool-agnostic):

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci                          # pinned install, not npm install

      - name: Lint
        run: npm run lint                    # fast; fail early

      - name: Unit tests
        run: npm test -- --coverage

      - name: Build
        run: npm run build                   # produce the deployable artifact

      - name: Docker build & push
        if: github.ref == 'refs/heads/main'  # only on merge to main
        run: |
          docker build -t shopfast:${{ github.sha }} .
          docker push registry.shopfast.io/shopfast:${{ github.sha }}
          # tag is the commit SHA — immutable, traceable, no "latest" in prod
```

### ShopFast setup

ShopFast's pipeline, end-to-end:

```
[Push to feature branch]
    → lint (30 s)
    → unit tests (2 min)
    → integration tests against test DB (3 min)
    → SAST (Static Application Security Testing) scan (1 min)
    → post results to PR (Pull Request)

[Merge to main]
    → all above steps (build-once artifact)
    → docker build → push to ECR (Elastic Container Registry) tagged :$GIT_SHA
    → deploy to staging (rolling update, 0 downtime)
    → smoke tests on staging (60 s)
    → canary deploy to prod: 5% of traffic → watch 10 min
    → promote to 100% or auto-rollback if error-rate > 1%
```

Canary deploy config (conceptual — matches the strategy table below):

```yaml
# deploy/canary.yml  (Argo Rollouts or equivalent)
strategy:
  canary:
    steps:
      - setWeight: 5           # 5% of prod traffic to new version
      - pause: {duration: 10m} # watch metrics for 10 minutes
      - setWeight: 50
      - pause: {duration: 5m}
      - setWeight: 100
    analysis:
      successCondition: "result[0] < 0.01"  # error rate < 1%
      failureCondition: "result[0] >= 0.01" # auto-rollback if exceeded
```

Environment variables and secrets never live in the pipeline YAML. They are injected from the CI secret store:

```bash
# bad — secret visible in logs and git history
docker build --build-arg DB_PASSWORD=supersecret .

# good — pulled from CI secret store at runtime
docker build --secret id=db_password,env=DB_PASSWORD .
```

### Common failures & how to debug

| Failure | Symptom | What to check |
|---|---|---|
| "Works in staging, breaks in prod" | Different behaviour across envs | Are you promoting the same artifact (same Docker digest) or rebuilding? |
| Flaky tests | CI randomly red; team ignores red | `--retry` hides flakiness; quarantine and fix; flaky = trust erosion |
| Canary catches nothing | Slow bugs reach 100% | Do you have enough traffic + metrics? Canary needs statistical signal |
| DB migration kills rollback | Can't roll back after schema change | Use expand/contract (additive migration first, code second, drop later) |
| Secret leaked in logs | CI log shows `DB_PASSWORD=...` | Never pass secrets as plain env args; use secret store injection |
| Deploy marker missing | Can't correlate metric spike to release | Add a deployment annotation to your metrics/dashboard on every deploy |
| Cold-start latency after deploy | p99 (99th-percentile latency) spikes post-deploy | Readiness probe must pass before traffic is shifted; add warm-up time |

The most common dangerous mistake at senior level: **coupling a destructive DB migration with the same release as the code change**. If you rename a column and update the app in the same deploy, you cannot roll back the app without also rolling back the migration — and rolling back a migration that deleted data is often impossible.

```bash
# Safe expand/contract pattern:
# Step 1: add new column (additive, non-breaking)
ALTER TABLE orders ADD COLUMN user_ref_id UUID;

# Step 2: deploy code that writes BOTH old + new column
# Step 3: backfill new column from old
# Step 4: deploy code that reads ONLY new column
# Step 5: drop old column (now safe — no running code reads it)
```

### Types & differences

| Strategy | Downtime | Rollback speed | Extra cost | Blast radius | Reach for it when |
|---|---|---|---|---|---|
| **Recreate** | Yes | Slow (redeploy) | None | Full | Dev/internal only; never prod |
| **Rolling** | No | Medium | None | Growing | Default; low cost; app must tolerate mixed versions |
| **Blue-Green** | No | Instant (flip) | ~2× temporarily | Full at cutover | Need instant rollback; full prod test before cutover |
| **Canary** | No | Fast (shift traffic back) | Small | Tiny → full | Catch real-traffic bugs early; need metrics + enough traffic |
| **Feature flag** | No | Instant (toggle off) | None | Scoped | Decouple deploy from release; kill-switch without redeploy |

---

CI/CD is the automation that turns a commit into running production software safely and repeatedly. Senior signal is less about which tool and more about **what guarantees the pipeline gives you** and **how you deploy without taking down users**.

---

## 1. CI vs CD vs CD

- **Continuous Integration (CI):** every push triggers automated build + test on a shared mainline, so integration problems surface in minutes, not at release. Prerequisite: small, frequent merges and a fast, reliable test suite.
- **Continuous Delivery (CD):** every change that passes CI is *deployable* — artifacts are built, tested, and parked one button-press from production.
- **Continuous Deployment (CD):** the same but production deploys happen **automatically** on green. Requires strong tests, observability, and fast rollback.

They form a ladder: you can't do continuous deployment without trustworthy CI underneath.

---

## 2. Pipeline anatomy

A typical pipeline is a DAG (Directed Acyclic Graph) of stages, each gating the next:

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

**Artifacts & registries:** images go to a container registry (ECR (Elastic Container Registry) / GCR (Google Container Registry) / Docker Hub); versioned by immutable digest, not mutable `latest`.

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
Route a **small % of real traffic** (1% → 5% → 25% → 100%) to B, watching error rate / latency / business metrics at each step. Automated canary analysis promotes or aborts. Pros: limits blast radius, catches issues only real traffic reveals. Cons: needs good metrics + traffic-splitting (service mesh / LB (Load Balancer) / feature flag) and enough traffic to be statistically meaningful.

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
- **Smoke tests + health checks** after deploy; **automated rollback** if SLOs (Service Level Objectives) breach within a monitoring window.
- **Deploy markers** in observability so you can correlate a metric spike with the exact release.

---

## 5. Quality & security gates

- **Test pyramid in CI:** many fast unit tests, fewer integration, fewest e2e (end-to-end). Flaky tests erode trust — quarantine and fix them.
- **Static analysis / SAST (Static Application Security Testing)**, dependency/vuln scanning (SCA (Software Composition Analysis)), license checks, container image scanning.
- **Secrets** come from the CI secret store / vault, never the repo; scope tokens with least privilege; short-lived OIDC (OpenID Connect) credentials over long-lived keys.
- **Required checks / branch protection** so nothing merges red.
- **Supply-chain:** pin actions/images by digest, generate SBOMs (Software Bills of Materials), sign artifacts (Sigstore/cosign), provenance (SLSA (Supply-chain Levels for Software Artifacts)) for high-assurance.

---

## 6. Key metrics (DORA)

**DORA (DevOps Research and Assessment)** metrics are the industry standard for measuring CI/CD health:

- **Deployment frequency** — how often you ship.
- **Lead time for changes** — commit → production.
- **Change failure rate** — % of deploys causing incidents.
- **MTTR (Mean Time To Recovery)** — time to restore service.

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
- DORA (DevOps Research and Assessment) metrics and what they tell you.
- Handling secrets and supply-chain security in CI.

---

## Quick-reference summary

- **CI (Continuous Integration)** = integrate+test every change; **CDelivery** = always deployable; **CDeployment** = auto-ship on green.
- **Build once, promote the immutable artifact** through environments.
- **Strategies:** recreate (downtime), rolling (no extra cost), blue-green (instant flip, 2× cost), canary (small blast radius, needs metrics).
- **Feature flags decouple deploy from release** and give a kill switch.
- **Safe rollback needs backward-compatible code + additive migrations (expand/contract).**
- **Gate** with tests, SAST (Static Application Security Testing) / SCA (Software Composition Analysis), secret hygiene, required checks; measure with **DORA (DevOps Research and Assessment)**.
