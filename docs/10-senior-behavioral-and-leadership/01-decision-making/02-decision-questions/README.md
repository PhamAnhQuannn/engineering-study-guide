# Decision Making — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Tradeoff reasoning, build vs buy, tech selection.

Each prompt frames concrete options. The senior signal is a **reasoned recommendation tied to criteria**, plus an explicit **"what would change the answer."**

---

### D1. Build an in-house auth system vs buy (Auth0/Okta/Cognito) vs adopt OSS (Keycloak)?

**Recommendation: Buy** for the vast majority of products. Auth is undifferentiated heavy lifting with brutal failure modes (breaches, account takeover, compliance). A vendor amortizes security expertise you can't match. Adopt OSS (Keycloak) only if data-residency/cost at scale or air-gapped requirements rule out SaaS and you have an ops team to run it. Build only if auth *is* your product or you have hard requirements no vendor meets.

**Reasoning:** TCO of "build" is dominated by ongoing security maintenance, not initial code. Per-MAU SaaS pricing hurts at scale but is cheap early; model the cost curve.

**What would change the answer:** scale where per-MAU pricing exceeds a dedicated identity team; strict data-residency; deeply custom auth flows; or auth becoming core differentiation.

---

### D2. Stick with the familiar language (Node/TS) vs adopt a "better-fit" one (Go/Rust) for a new high-throughput service?

**Recommendation: Default to the familiar** unless the workload has a *measured* need the current stack structurally can't meet (CPU-bound throughput, tail-latency, memory footprint). A new language is a multi-year org commitment: hiring, tooling, libraries, on-call expertise, a second ecosystem to secure.

**Reasoning:** Language diversity is an innovation token spent on *every* future engineer; the cost is org-wide and permanent.

**What would change the answer:** a profiled bottleneck the current stack can't solve; a strategic bet where the new language is core; or a team already fluent in the candidate.

---

### D3. Adopt a new framework now (greenfield) vs wait for it to mature?

**Recommendation:** Distinguish reversibility. For an *internal, replaceable* service, early adoption is a two-way door — fine if the team likes it. For a *foundational, hard-to-migrate* layer (ORM, API framework, build system), wait for maturity: stable releases, battle-testing, security track record, hiring pool.

**What would change the answer:** the framework solves a real current pain; strong signal of staying power; or you can isolate it behind an abstraction so swapping later is cheap.

---

### D4. Decide by consensus vs by a single accountable decider (DACI "D")?

**Recommendation:** Use a **single accountable decider** for Type-1/cross-cutting calls, after broad *consultation*. Reserve full consensus for decisions whose execution depends on buy-in (team conventions, on-call rotation). Consensus on architecture tends to converge on the lowest common denominator and stalls.

**What would change the answer:** contentious decisions where execution depends entirely on team commitment lean toward consensus; trivial reversible calls should just be delegated, no process.

---

### D5. Microservices from day one vs modular monolith first?

**Recommendation: Modular monolith first** for nearly all new products. You don't yet know the right service boundaries; premature splitting buys distributed-systems pain (network failures, distributed transactions, deploy complexity) before product-market fit. Enforce module boundaries in-process; extract services later where data shows a real scaling or team-autonomy need.

**What would change the answer:** clear, stable bounded contexts already known; independent scaling needs from day one; or multiple teams that must deploy independently immediately.

---

### D6. Pay down a specific tech debt now vs ship the roadmap feature?

**Recommendation:** Decide on **cost of delay vs the debt's interest rate**. If the debt slows every change (high interest) or risks an incident, pay it — framed as velocity/risk, not "cleanliness." If dormant and isolated, defer and track. Rarely binary; usually carve a thin remediation slice alongside the feature.

**What would change the answer:** an imminent launch (defer, record the risk); debt on the critical path of the next three features (pay now); or a looming compliance/security exposure (pay now, non-negotiable).

---

### D7. Managed cloud DB (RDS/Aurora) vs self-hosted on K8s vs serverless (DynamoDB/Spanner)?

**Recommendation: Managed relational** as default — backups, failover, patching for free, SQL flexibility retained. Serverless NoSQL only when access patterns are known, simple, and need extreme elasticity. Self-host only with a dedicated DBA/SRE team and a cost/control reason justifying the operational burden.

**What would change the answer:** spiky unpredictable load with simple key access (serverless); strict cost control at huge scale with ops capacity (self-host); multi-region strong consistency (Spanner/CockroachDB).

---

### D8. Standardize the whole org on one tool/pattern vs let teams choose locally?

**Recommendation:** Standardize the **load-bearing, cross-cutting** choices (observability, CI/CD, language set, deploy tooling) for leverage and engineer mobility; allow **local autonomy** on genuinely team-internal, reversible choices. The test: does a wrong local choice leak cost onto other teams or future hires? If yes, standardize.

**What would change the answer:** a small single-team org (autonomy is free); or a tool strictly internal to one team with no shared on-call.
