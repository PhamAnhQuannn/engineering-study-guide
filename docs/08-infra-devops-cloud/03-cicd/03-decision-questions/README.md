# CI/CD & Deploys — Decision & Tradeoff Questions

> Topic: Pipelines, blue-green, canary, rollback.

[← Topic overview](../README.md)

Each prompt presents options. Give a reasoned recommendation plus "what would change the answer."

---

### D1. Blue-green vs canary vs rolling for a payments API serving 50k RPS?

**Options:** (A) Rolling, (B) Blue-green, (C) Canary.

**Recommendation:** **Canary.** A payments path is high-blast-radius and high-traffic; you want a defect to hit 1% of transactions, not all of them, and 50k RPS gives ample volume for statistically meaningful canary analysis (error rate, latency, auth-failure, decline rate). Automated abort on metric regression.

**What would change it:** If you lack traffic-splitting infrastructure or metrics maturity, **blue-green** gives instant rollback and a clean test-before-flip with simpler tooling (just an LB swap), at ~2× cost during the window. If the service is internal/low-criticality and the team is small, **rolling** is the cheapest and is fine when versions are compatible.

---

### D2. Self-hosted CI runners vs cloud-hosted (managed) runners?

**Options:** (A) Managed (GitHub-hosted/GitLab SaaS), (B) Self-hosted.

**Recommendation:** Start with **managed runners** — zero maintenance, autoscaling, no infra to patch. Most teams never outgrow them.

**What would change it:** Move to **self-hosted** when you need (a) access to private network resources/databases, (b) special hardware (GPU, ARM, large RAM), (c) compliance/data-residency that forbids third-party runners, or (d) cost at very high build volume. The tradeoff is you now own patching, scaling, and runner security (a compromised self-hosted runner is a serious supply-chain risk).

---

### D3. Monorepo single pipeline vs per-service pipelines?

**Options:** (A) One pipeline for the whole monorepo, (B) Independent pipelines per service.

**Recommendation:** In a monorepo, use **path-filtered / affected-target pipelines** — one logical system that only builds and tests the projects affected by a change (Bazel/Nx/Turborepo "affected" graphs). This keeps CI fast as the repo grows while preserving atomic cross-service changes.

**What would change it:** With polyrepo (separate repos), per-service pipelines are natural and give team autonomy + independent deploy cadence, at the cost of harder cross-cutting changes and dependency drift. Choose based on repo topology and how often changes span service boundaries.

---

### D4. Trunk-based development vs GitFlow for a web service deploying daily?

**Options:** (A) Trunk-based (short-lived branches, flags), (B) GitFlow (develop/release/hotfix branches).

**Recommendation:** **Trunk-based.** Daily/continuous deployment thrives on small, frequently-merged changes behind feature flags; long-lived branches cause merge hell and defeat CI. CI stays meaningful, deploys stay small and reversible.

**What would change it:** GitFlow makes sense for **versioned, scheduled releases** of installed/distributed software (mobile apps, on-prem products) where you maintain multiple released versions and need explicit release/hotfix branches. For a continuously-deployed SaaS it's overhead.

---

### D5. Run e2e/integration tests as a blocking gate on every PR vs post-merge?

**Options:** (A) Block every PR on full e2e, (B) Run fast tests on PR + full e2e post-merge/nightly, (C) Both with selective e2e on PR.

**Recommendation:** **(C)** Run the fast pyramid (lint, unit, key integration) as a blocking PR gate, plus a *selective* smoke subset of e2e; run the full e2e suite post-merge and nightly. This keeps PR feedback fast (minutes) while still catching regressions before they reach prod via the post-merge gate that blocks deploy.

**What would change it:** If e2e is fast and reliable, block everything on PR for maximum safety. If e2e is slow/flaky, never block PRs on it — you'll destroy velocity and train people to ignore red. The deciding factors are suite duration and flakiness.

---

### D6. Automated rollback on SLO breach vs human-gated rollback?

**Options:** (A) Fully automated rollback, (B) Page a human to decide, (C) Auto-rollback for clear signals + page for ambiguous ones.

**Recommendation:** **(C).** Auto-rollback on unambiguous, well-understood signals (5xx spike, health-check failures, error-budget burn past a clear threshold) within the post-deploy window — speed of MTTR matters. Page a human for ambiguous degradations where an automated rollback might be wrong or where rollback itself is risky (e.g., migration involved).

**What would change it:** Low-traffic or low-maturity observability → favor human gating to avoid false-positive rollbacks. Very high traffic with mature, trusted SLOs → push more toward full automation.

---

### D7. Bake secrets/config into the image vs inject at runtime?

**Options:** (A) Bake into image, (B) Inject via env/secret store at runtime, (C) Mount from a vault.

**Recommendation:** **Never bake secrets into images** (they leak via registry access and persist in layers). Bake only *non-secret, environment-agnostic* config; inject environment-specific config via env vars and secrets via a vault/secret store (B/C). This also preserves "build once, promote everywhere" — the same image runs in every environment, parameterized by injected config.

**What would change it:** Truly static, non-sensitive config can be baked for simplicity. But anything secret or environment-specific must be external, or you break both security and artifact promotion.

---

### D8. Push deploys (CI pushes to cluster) vs pull-based GitOps?

**Options:** (A) CI runs `kubectl/terraform apply` (push), (B) GitOps agent (Argo CD/Flux) reconciles cluster to a Git-declared desired state (pull).

**Recommendation:** **GitOps (pull)** for Kubernetes at scale: Git is the single source of truth, the cluster continuously reconciles to it, drift is auto-corrected, rollback = `git revert`, and CI never needs cluster-admin credentials (smaller attack surface). Strong audit trail.

**What would change it:** For simple setups, few environments, or non-K8s targets (serverless, VMs), push-based deploys from CI are simpler and perfectly adequate. GitOps shines when you have many clusters/environments and want declarative drift control.
