# Infrastructure as Code — Decision & Tradeoff Questions

> Topic: Terraform, config management, immutable infra.

[← Topic overview](../README.md)

Each prompt presents options. Give a reasoned recommendation plus "what would change the answer."

---

### D1. Terraform vs CloudFormation vs Pulumi vs CDK for a new platform?

**Options:** (A) Terraform, (B) CloudFormation (AWS-native), (C) Pulumi/CDK (general-purpose languages).

**Recommendation:** **Terraform** as the default — multi-cloud, huge provider ecosystem, mature module registry, and the de-facto industry standard (transferable skills, easy hiring). Its declarative HCL is approachable and the plan/apply/state model is well understood.

**What would change it:** Go **CloudFormation** if you're all-in on AWS and want native integration (StackSets, drift detection, no extra state to manage, tight service support). Choose **Pulumi/CDK** if your team strongly prefers expressing infra in a real programming language (TypeScript/Python/Go) with loops, conditionals, and unit tests — powerful for complex logic, at the cost of more abstraction and the ability to write "too-clever" infra. License/governance concerns around Terraform's licensing may also push teams toward OpenTofu.

---

### D2. Mutable infrastructure (patch in place / config management) vs immutable infrastructure (replace images)?

**Options:** (A) Mutable (Ansible/Chef on long-lived servers), (B) Immutable (golden images, replace instances).

**Recommendation:** **Immutable** for modern cloud/container workloads — no drift, identical disposable instances, trivial rollback (redeploy prior image), and a natural fit with auto-scaling and blue-green/canary. Build once, deploy many.

**What would change it:** **Mutable** config management still fits long-lived stateful hosts you can't easily re-image, legacy systems, bare-metal fleets, or environments where a full image-build pipeline isn't justified. The tradeoff is you must actively fight drift (enforce config management runs) and accept slower, riskier in-place changes. Most greenfield work should be immutable; the constraint is usually legacy/stateful systems.

---

### D3. Remote state vs local state for Terraform?

**Options:** (A) Local state file, (B) Remote state with locking (S3+DynamoDB / Terraform Cloud / GCS).

**Recommendation:** **Remote state with locking — essentially always for anything beyond a solo throwaway.** A team needs a shared source of truth; local state can't be shared and two engineers will corrupt each other's view. Remote state adds locking (no concurrent applies), encryption at rest, and durability.

**What would change it:** Local state is only acceptable for a personal experiment or a quick learning sandbox with a single operator and disposable resources. The moment a second person or production is involved, remote state is mandatory.

---

### D4. One large monolithic state vs splitting state by environment/domain?

**Options:** (A) Single state for everything, (B) State split per environment and/or per domain (network, data, app).

**Recommendation:** **Split state** — separate at least per environment (dev/staging/prod) and often per domain. Smaller states mean faster plans, smaller blast radius (a mistake in the app state can't destroy the network state), independent ownership, and tighter access control on sensitive states.

**What would change it:** A tiny project with a handful of resources can live in one state for simplicity. But as it grows, monolithic state becomes slow to plan and dangerous (one apply touches everything). The cost of splitting is managing dependencies between states (remote state data sources / outputs) — worth it past a small size.

---

### D5. Apply Terraform manually from laptops vs automated pipeline (Atlantis / Terraform Cloud / CI)?

**Options:** (A) Engineers run `apply` locally, (B) Automated plan-on-PR + apply-on-merge pipeline.

**Recommendation:** **Automated pipeline.** Plan posted on the PR for review, apply only after merge + approval, with policy-as-code gates. This gives auditability, prevents unreviewed or conflicting local applies, keeps credentials out of laptops (the pipeline holds scoped creds), and enforces the same rigor as application code.

**What would change it:** Solo/early-stage projects can apply locally to move fast. But once multiple engineers share state and prod is real, local applies cause conflicts, drift, and un-audited changes — move to a pipeline. The setup overhead pays back quickly in safety.

---

### D6. Hand-roll your own modules vs use public/community Terraform modules?

**Options:** (A) Write all modules in-house, (B) Use public registry modules, (C) Wrap public modules in thin internal modules.

**Recommendation:** **(C)** for most teams — build thin internal modules that encode *your* standards (tagging, naming, security defaults) and optionally wrap well-maintained public modules underneath. This balances reuse with control and consistency.

**What would change it:** Use **public modules directly** for commodity, well-understood infra to move fast (but pin versions and review them — you're trusting third-party code with cloud access). **Hand-roll** when your requirements are unusual, you need to minimize external dependencies/supply-chain risk, or public modules are over-abstracted for your case. Always pin versions regardless.

---

### D7. Enforce guardrails with policy-as-code vs rely on code review alone?

**Options:** (A) Human review only, (B) Policy-as-code (checkov/OPA/Sentinel/tflint) in the pipeline, (C) Both.

**Recommendation:** **(C)** — automated policy-as-code as a hard gate (no public S3 buckets, required tags, allowed regions/instance types, no `0.0.0.0/0` SSH) *plus* human review for judgment. Machines catch the mechanical/security rules consistently; humans catch intent and design.

**What would change it:** A tiny team with low change volume might lean on review alone initially. But as the team and surface area grow, humans miss things and standards drift — automated policy enforcement scales where review doesn't, and it's a compliance requirement in regulated environments. The cost is maintaining the policy set, which is well worth it.
