# Infrastructure as Code — Knowledge / Study Notes

> Topic: Terraform, config management, immutable infra.

[← Topic overview](../README.md)

Infrastructure as Code (IaC) means defining and provisioning infrastructure through machine-readable definitions in version control, not by clicking consoles or running ad-hoc commands. Senior signal: understanding **declarative vs imperative**, **state and drift**, **immutable infrastructure**, and how to operate IaC safely at team scale.

---

## 1. Why IaC

- **Reproducibility** — rebuild an identical environment from code; no "works on my cluster".
- **Version control** — infra changes get diffs, PRs, review, history, blame, and rollback (`git revert`).
- **Auditability & collaboration** — every change is traceable to a commit/author.
- **Consistency** — dev/staging/prod parity from the same modules, killing config drift and snowflake servers.
- **Speed & scale** — stand up dozens of resources with one apply; tear down to save cost.
- **Disaster recovery** — re-provision a region from code.

Without IaC you get **configuration drift** (manual changes diverge environments) and **snowflake servers** (uniquely hand-tweaked, impossible to reproduce) — the things IaC exists to eliminate.

---

## 2. Declarative vs imperative

- **Declarative** (Terraform, CloudFormation, Pulumi, Kubernetes manifests): you describe the **desired end state**; the tool computes the diff and the actions to reach it. Idempotent — applying twice converges to the same state. This is the dominant model.
- **Imperative** (raw shell, `aws cli` scripts, Ansible's procedural side): you specify the **sequence of steps**. More control, but you must handle "what if it already exists / partially ran" yourself; not naturally idempotent.

Most modern IaC is declarative because **idempotency** and convergence are exactly what you want for repeatable infra.

---

## 3. Provisioning vs configuration management

- **Provisioning** (Terraform, CloudFormation, Pulumi) — creates/updates/destroys cloud *resources* (VMs, networks, DBs, IAM).
- **Configuration management** (Ansible, Chef, Puppet, Salt) — configures the *inside* of existing machines (install packages, manage files/services, set users). 

They compose: Terraform stands up the VMs/network; Ansible (or, increasingly, a baked image) configures them. With immutable infrastructure, config management shrinks because you bake configuration into images instead.

---

## 4. Terraform mechanics (the canonical tool)

- **HCL** declarative config; **providers** are plugins that talk to a platform's API (AWS, GCP, Azure, k8s, Datadog…).
- **Resources** = managed objects; **data sources** = read-only lookups; **variables/outputs**; **modules** = reusable, parameterized groups of resources (the unit of DRY and sharing).
- **The workflow:** `init` (download providers/modules, configure backend) → `plan` (compute the diff: create/update/replace/destroy — **review this**) → `apply` (execute) → `destroy`.
- **The dependency graph:** Terraform builds a DAG from references between resources and applies in dependency order, parallelizing independent ones.

### State — the single most important concept
Terraform keeps a **state file** mapping your config to real-world resource IDs and caching their attributes. It needs state to know what it manages and to compute diffs.

- **Remote state** (S3+DynamoDB lock, Terraform Cloud, GCS) is mandatory for teams — local state can't be shared and causes conflicts.
- **State locking** prevents two `apply`s from racing and corrupting state.
- **State is sensitive** — it can contain secrets (DB passwords, keys) in plaintext; encrypt at rest, restrict access.
- **Drift** — when reality diverges from state (someone changed it in the console). `terraform plan` detects drift; `apply` reconciles it back to code. **Don't make manual changes to IaC-managed resources** — they get reverted or cause confusing diffs.
- **`terraform import`** brings an existing un-managed resource under management; **`state mv/rm`** refactor state without destroying resources; **moved blocks** rename resources safely.

### Dangerous edges
- A change that forces **replacement** (immutable attribute) can destroy-then-create — read the plan for `-/+` (replace) markers; this can cause downtime or data loss (e.g., replacing a DB).
- `terraform destroy`/removing a resource from config deletes real infrastructure — guard prod with `prevent_destroy`, plan review, and approvals.

---

## 5. Immutable infrastructure

Instead of patching/mutating running servers (**mutable**, leads to drift and snowflakes), you **never change a running server** — to update, you **build a new image and replace the instance** (immutable / "cattle not pets").

- **Build once (e.g., Packer/Docker image), deploy many**, swap instances on change.
- Pairs naturally with auto-scaling groups, blue-green/rolling deploys, and golden AMIs/containers.
- **Benefits:** no drift (every instance is identical and disposable), trivial rollback (redeploy the prior image), predictable + testable, easy horizontal scaling.
- **Tradeoffs:** every change is a rebuild+redeploy (no quick SSH hotfix — which is also the point); state must live outside the instance (DBs, volumes, object storage); image build pipeline needed.

---

## 6. Operating IaC at team scale

- **Workspaces / separate state per environment** (or directory-per-env) to isolate dev/staging/prod blast radius.
- **Modules** for reuse + standards; pin module/provider **versions** for reproducibility.
- **CI/CD for IaC:** `plan` on PR (post the diff for review), `apply` on merge with approvals — same gates as app code. Many teams use **Atlantis** or Terraform Cloud for plan/apply automation.
- **Policy as code:** OPA/Sentinel/`tflint`/`checkov` to enforce guardrails (no public buckets, tagging required, allowed instance types) before apply.
- **Secrets:** never hardcode; pull from a secrets manager/vault; keep them out of state where possible.
- **GitOps** extends the idea: Git is the desired state, an agent continuously reconciles.

---

## Common pitfalls & misconceptions

- **Manual ("ClickOps") changes to managed resources** → drift, confusing plans, reverted changes.
- **Local/unshared state** on a team → conflicts and corruption; use remote state + locking.
- **Not reading the plan** → an apply silently replaces/destroys a stateful resource.
- **Secrets in state or in HCL** committed to Git.
- **Giant monolithic state** → slow plans and one blast radius for everything; split by domain/env.
- Treating IaC as write-once — it's living code needing review, versioning, and tests.
- Forgetting that `destroy` and removing-from-config delete real infra (and data).
- Mutable in-place patching that recreates snowflakes — prefer immutable images.

---

## What interviewers probe

- Declarative vs imperative; why idempotency matters.
- What Terraform state is, why remote state + locking, and how drift is detected/handled.
- What "immutable infrastructure" means and its tradeoffs.
- Provisioning vs configuration management.
- How you review/gate IaC changes (plan-on-PR, policy-as-code) and protect prod from accidental destroys.
- Handling secrets in IaC.
- How you'd bring existing manual infra under Terraform (`import`).

---

## Quick-reference summary

- **IaC** = infra defined in version-controlled code → reproducible, auditable, drift-free, reviewable.
- **Declarative (desired state, idempotent)** dominates; **provisioning** (Terraform) vs **config mgmt** (Ansible).
- **Terraform:** `init → plan → apply`; a **DAG** of resources; **state** maps config→real resources.
- **State must be remote + locked + encrypted**; **drift** = reality ≠ state, detected by `plan`; don't ClickOps managed resources.
- **Immutable infra:** replace instances via new images instead of patching → no drift, easy rollback, state lives externally.
- **Operate it like app code:** modules, pinned versions, plan-on-PR, policy-as-code, secrets from a vault, per-env state.
