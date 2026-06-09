# Secrets & Least Privilege — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Secrets management, key rotation, least privilege.

---

### D1. Managed secrets manager (AWS Secrets Manager / cloud) vs self-hosted Vault vs environment variables?

**Options**
- **A. Cloud-managed** (AWS Secrets Manager, GCP/Azure equivalents) — zero ops, native IAM integration, per-secret pricing.
- **B. Self-hosted HashiCorp Vault** — powerful (dynamic secrets, broad backends), cloud-agnostic, but you operate it (HA, unsealing, upgrades).
- **C. Plain environment variables** from the platform.

**Recommendation:** For teams already on one cloud, **A** is the pragmatic default — least operational burden, tight IAM and audit integration. Choose **B (Vault)** when you need **dynamic/ephemeral secrets**, multi-cloud portability, or advanced features, and have the ops maturity to run it HA. **C alone is insufficient** for sensitive secrets (no rotation, no audit, easily leaked), though injecting manager-sourced values *as* env vars at runtime is fine.

**What would change the answer:** Multi-cloud or a strong need for dynamic DB/cloud credentials → Vault. A small single-cloud team → managed. Regulatory requirements for an on-prem HSM may force a specific backend.

---

### D2. Long-lived static credentials vs short-lived dynamic credentials?

**Options**
- **A. Long-lived static** keys (rotated periodically).
- **B. Short-lived dynamic** credentials (minted on demand, auto-expire).
- **C. Static with frequent automated rotation** as a middle ground.

**Recommendation:** Prefer **B** wherever the platform supports it — there's essentially no durable secret to steal, rotation is automatic, and leases are revocable. Use **C** for systems that can't consume dynamic credentials yet (legacy integrations) — automate rotation so it's not a manual scramble. **A without automation is the weakest** and the source of most "we can't rotate without an outage" pain.

**What would change the answer:** A third-party that only issues long-lived API keys forces A/C — then compensate with tight scoping, monitoring, and a tested rotation runbook. Latency-sensitive paths may cache short-lived creds carefully.

---

### D3. Rotate a leaked key by editing it everywhere vs design indirection up front?

**Options**
- **A. Direct reference** — each consumer holds the literal secret; rotation = update them all.
- **B. Indirection** — consumers reference the secret by *name/alias* from a manager; rotation updates one place.
- **C. Key IDs / dual-active** — multiple valid keys identified by `kid`, retire the old after cutover.

**Recommendation:** Design for **B + C** before you ever need to rotate. Consumers fetch "the current DB password" by name from the manager, and signing systems accept multiple `kid`s during overlap. This turns rotation into a routine, zero-downtime operation. **A guarantees a painful, error-prone scramble** during an incident — exactly the wrong time for manual edits across many services.

**What would change the answer:** A single small service might tolerate A, but even then the indirection cost is low. The more consumers a secret has, the more decisively you want B/C.

---

### D4. Broad team-wide IAM role vs per-service least-privilege roles?

**Options**
- **A. One broad role** shared by a team/several services (convenient).
- **B. Per-service narrowly-scoped roles.**
- **C. Per-service roles + permission boundaries/JIT elevation for rare admin tasks.**

**Recommendation:** **B**, escalating to **C** for sensitive environments. Per-service identities contain blast radius (a compromised service can't touch unrelated resources), make access auditable, and allow independent rotation. **A trades a small convenience for a large, un-auditable blast radius** and is a common audit finding. Add **JIT elevation** so humans don't hold standing admin.

**What would change the answer:** Very early prototypes may start broad for speed, but tighten before production. High-compliance environments mandate C (separation of duties, JIT, reviews).

---

### D5. Block all secrets in code via pre-commit hooks vs CI scanning vs both?

**Options**
- **A. Pre-commit hooks only** (catch before commit, but bypassable/uninstalled).
- **B. CI scanning only** (server-side, can't be skipped, but secret already in history).
- **C. Both, plus platform push-protection.**

**Recommendation:** **C — defense in depth.** Pre-commit gives fast local feedback and prevents most leaks before they happen; CI/push-protection is the non-bypassable backstop. Relying on **A alone** fails when a developer hasn't installed the hook; relying on **B alone** means the secret already entered history (and must be rotated even if the PR is blocked). Combine them and add canary tokens for detection.

**What would change the answer:** A small solo project might start with just CI/push-protection. Larger orgs should mandate both and centrally enforce hooks.

---

### D6. Inject secrets as environment variables vs mounted files (tmpfs)?

**Options**
- **A. Environment variables** — simple, widely supported.
- **B. Mounted files** (tmpfs) the app reads.
- **C. Fetch directly from the manager SDK in-process.**

**Recommendation:** All three are acceptable if sourced from a manager at runtime; the nuance: **env vars can leak more easily** (child processes inherit them, crash dumps and `/proc/<pid>/environ` may expose them, some logging frameworks dump the environment). **B (files on tmpfs)** avoids inheritance and is easy to rotate by re-writing the file; **C** keeps secrets in memory only and supports dynamic renewal. For sensitive, frequently-rotated secrets, prefer **B or C**; env vars are fine for low-sensitivity config.

**What would change the answer:** Platform/tooling constraints (many PaaS only offer env vars) may force A — then scrub logs and avoid dumping the environment. Frequent rotation favors files/SDK over static env vars set only at boot.
