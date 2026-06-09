# Cloud Core — Decision & Tradeoff Questions

> Topic: AWS/GCP compute, storage, network, IAM.

[← Topic overview](../README.md)

Each prompt presents options. Give a reasoned recommendation plus "what would change the answer."

---

### D1. Serverless (Lambda/Cloud Functions) vs containers (ECS/EKS) vs VMs for a new backend service?

**Options:** (A) Serverless, (B) Managed containers, (C) VMs.

**Recommendation:** Default to **managed containers** for a typical always-on backend — portable, predictable cost at steady load, full control of runtime, no cold starts, and a clean local→prod story. 

**What would change it:** Pick **serverless** if traffic is spiky or low-baseline (scale-to-zero saves money), it's event-driven glue, and cold-start latency is acceptable. Pick **VMs** if you need special OS/kernel/hardware, run legacy/stateful software, or want maximum control. The crossover: at sustained high throughput serverless gets expensive; at low/spiky volume it's cheapest.

---

### D2. Multi-AZ only vs multi-region for availability?

**Options:** (A) Single region, multi-AZ, (B) Active-passive multi-region, (C) Active-active multi-region.

**Recommendation:** Start with **multi-AZ in one region** — it survives datacenter failures, covers the vast majority of outages, and is far simpler and cheaper. Most services should stop here.

**What would change it:** Go **multi-region** when you have (a) a strict RTO/RPO that an entire-region outage would violate, (b) global users needing low latency, or (c) regulatory data-locality. Active-passive (warm standby + failover) is simpler than active-active; active-active maximizes availability and latency but forces you to solve cross-region data consistency/replication — a large complexity and cost jump. Decide based on whether a region-level outage is an acceptable risk for the business.

---

### D3. Managed database (RDS/Aurora, Cloud SQL) vs self-hosting a database on VMs?

**Options:** (A) Managed DB, (B) Self-hosted on EC2/Compute Engine.

**Recommendation:** **Managed.** It offloads patching, backups, replication, failover, and monitoring — the operationally hardest parts — for a modest premium. For 95% of teams this is the right call.

**What would change it:** Self-host only when you need a database/version/extension the managed service doesn't support, require kernel/storage tuning the provider won't allow, or operate at a scale where the managed premium is significant *and* you have dedicated DBA/SRE expertise. The hidden cost of self-hosting is the on-call burden of getting backups, failover, and upgrades right.

---

### D4. IAM roles (assumed, short-lived) vs IAM users with access keys for application/service auth?

**Options:** (A) Roles with temporary credentials, (B) IAM users + long-lived access keys.

**Recommendation:** **Roles, essentially always** for workloads — EC2 instance profiles, EKS IRSA, GCP Workload Identity, or cross-account `AssumeRole`. Credentials are short-lived, auto-rotated, and never stored, eliminating the most common breach vector (leaked static keys).

**What would change it:** Use access keys only for a narrow set of cases where role assumption truly isn't possible (some external/CI integrations) — and then scope them tightly, rotate them, and prefer OIDC federation (e.g., GitHub Actions → cloud) to avoid static keys even there. There's almost no good reason for long-lived keys on in-cloud compute.

---

### D5. Provisioned (reserved/committed) vs on-demand vs spot for a production fleet?

**Options:** (A) All on-demand, (B) Reserved/committed baseline + on-demand burst, (C) Heavy spot.

**Recommendation:** **(B)** — cover your steady baseline with reserved instances / savings plans / committed-use (big discount for predictable load) and handle bursts with on-demand. This minimizes cost while keeping production reliable.

**What would change it:** Add **spot** for the *interruptible, stateless* portion (batch, async workers, even some stateless web behind an ASG with on-demand fallback) to cut cost further. Stay **all on-demand** only for brand-new, unpredictable workloads where you can't yet forecast a baseline to commit to. Stateful/latency-critical singletons should never run solely on spot.

---

### D6. Security Groups vs Network ACLs — which to rely on for instance-level access control?

**Options:** (A) Security Groups, (B) NACLs, (C) Both layered.

**Recommendation:** Use **Security Groups as the primary control.** They're stateful (return traffic auto-allowed), attach directly to instances, and are easier to reason about and reference (SG-to-SG rules). 

**What would change it:** Add **NACLs** for coarse, subnet-wide *deny* rules that Security Groups can't express (SGs are allow-only) — e.g., block a malicious CIDR across an entire subnet, or enforce a defense-in-depth boundary. Layer both for compliance/zero-trust, accepting that stateless NACLs require explicit rules for both request and response directions.

---

### D7. Store application secrets in environment variables vs a managed secrets manager?

**Options:** (A) Plain env vars / config files, (B) Managed secrets manager (Secrets Manager / Secret Manager / Vault).

**Recommendation:** **Managed secrets manager.** It gives encryption at rest, fine-grained IAM access, audit logging, and automated rotation; the app fetches secrets at runtime via its role. Env vars are fine as the *delivery* mechanism into the process, but the source of truth should be the secrets manager — not a committed file.

**What would change it:** For trivial, non-sensitive config, plain env/config is fine. But anything secret (DB passwords, API keys, signing keys) belongs in a secrets manager with rotation; baking them into images or committing them to repos is the recurring root cause of breaches.

---

### D8. Single shared cloud account/project vs separate accounts per environment?

**Options:** (A) One account with tags/IAM separation, (B) Separate accounts per env (dev/staging/prod).

**Recommendation:** **Separate accounts** (GCP projects) per environment under an organization. It gives hard **blast-radius isolation** (a dev compromise or runaway script can't touch prod), clean cost attribution, and per-environment guardrails via SCPs/Org Policies.

**What would change it:** A single account with disciplined IAM + tagging can be acceptable for a very small team or early-stage project to reduce overhead. But as soon as you have real production data and multiple engineers, the isolation of separate accounts outweighs the management overhead — automate account vending (Control Tower / Landing Zone) to keep it manageable.
