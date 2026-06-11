# Infrastructure as Code — Knowledge / Study Notes

> Topic: Terraform, config management, immutable infra.

[← Topic overview](../README.md)

> **🛒 Where we are in building ShopFast** — Last topic we learned to diagnose [Linux & OS problems](../../05-linux-os/01-knowledge/README.md) on the servers ShopFast runs on. But right now those servers were provisioned by hand in the AWS console — that's fragile, unreviewed, and unrepeatable. This topic replaces ClickOps with IaC (Infrastructure as Code): every VPC (Virtual Private Cloud), RDS (Relational Database Service) instance, and IAM (Identity and Access Management) role is declared in version-controlled Terraform, reviewed in a PR (Pull Request), and applied by CI (Continuous Integration). **Next:** the networking layer those resources sit on — [HTTP & Networking](../../../08-networking/01-http/01-knowledge/README.md) — including TLS (Transport Layer Security) on checkout and HTTP version choices at the edge.

---

## Teaching arc: codifying ShopFast's infrastructure

### What it is

**IaC (Infrastructure as Code)** means defining and provisioning cloud infrastructure — servers, networks, databases, IAM roles — as machine-readable code in version control, instead of clicking through a web console or running ad-hoc shell commands.

Analogy: sheet music. Before sheet music, each orchestra performance was improvised differently — some musicians played louder, some slower, the piece was never quite the same. Sheet music is the definitive, reproducible declaration of the piece: any orchestra can pick it up and produce an identical performance. Terraform is sheet music for your infrastructure: the code is the authoritative definition; any CI/CD (Continuous Integration / Continuous Delivery) pipeline can pick it up and provision an identical environment in any region.

### Why we use it

Without IaC, ShopFast's team hits these problems:

- **"How was staging set up?"** — Nobody remembers; the engineer who did it left. Can't reproduce it.
- **"Prod and staging differ"** — Someone manually tweaked a security group in prod "for a quick fix" three months ago; now bugs appear only in prod.
- **"We can't audit infra changes"** — A VPC (Virtual Private Cloud) subnet was changed; no record of who did it, when, or why.
- **Disaster recovery takes days** — A region fails; rebuilding from memory + runbooks takes 48 hours.

IaC solves all four: every infra change is a PR (Pull Request), reviewed, merged, and applied by a pipeline; every environment is an identical instantiation of the same code; DR (Disaster Recovery) is a `terraform apply` away.

### What it looks like

A minimal Terraform configuration provisioning ShopFast's RDS Postgres instance:

```hcl
# infra/modules/database/main.tf

variable "env" { type = string }           # "staging" or "prod"
variable "instance_class" { type = string } # e.g. "db.t3.medium"

resource "aws_db_instance" "shopfast" {
  identifier        = "shopfast-${var.env}"
  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = var.instance_class
  allocated_storage = 20
  storage_encrypted = true                 # encrypt at rest — always

  db_name  = "shopfast"
  username = "shopfast_app"
  password = var.db_password               # from a secrets manager, never hardcoded

  multi_az               = var.env == "prod" ? true : false  # HA only in prod
  deletion_protection    = var.env == "prod" ? true : false  # guard prod data

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.private.name  # private subnet only

  backup_retention_period = 7   # 7 days of automated backups
  skip_final_snapshot     = false

  tags = { Environment = var.env, ManagedBy = "terraform" }
}
```

The `plan` output before applying — **always read this**:

```
# aws_db_instance.shopfast will be created
+ resource "aws_db_instance" "shopfast" {
    + identifier        = "shopfast-prod"
    + multi_az          = true
    + storage_encrypted = true
    ...
  }

Plan: 1 to add, 0 to change, 0 to destroy.
```

A `-/+` (replace) marker means Terraform will **destroy then recreate** that resource — this can cause downtime or data loss for stateful resources like a database.

### ShopFast setup

ShopFast's IaC repository layout:

```
infra/
  modules/
    networking/    # VPC, subnets, NAT Gateway, Security Groups
    database/      # RDS Postgres, parameter groups
    cache/         # ElastiCache Redis
    eks/           # EKS cluster, node groups, IAM roles
    iam/           # CI roles, service accounts
  environments/
    staging/
      main.tf      # calls modules with staging-sized vars
      terraform.tfvars
    prod/
      main.tf      # calls modules with prod-sized vars; deletion_protection=true
      terraform.tfvars
  backend.tf       # remote state in S3 + DynamoDB lock
```

Remote state config (required for team use — never use local state):

```hcl
# infra/backend.tf
terraform {
  backend "s3" {
    bucket         = "shopfast-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true                    # state can contain secrets — encrypt it
    dynamodb_table = "shopfast-tf-locks"     # prevents two engineers applying at once
  }
}
```

CI/CD pipeline for IaC (plan on PR, apply on merge — same discipline as app code):

```yaml
# .github/workflows/terraform.yml
on:
  pull_request:
    paths: ["infra/**"]
  push:
    branches: [main]
    paths: ["infra/**"]

jobs:
  plan:
    if: github.event_name == 'pull_request'
    steps:
      - run: terraform init
      - run: terraform plan -out=tfplan     # compute diff
      - run: terraform show tfplan          # post diff as PR comment

  apply:
    if: github.event_name == 'push'         # only on merge to main
    environment: production                 # requires manual approval gate
    steps:
      - run: terraform init
      - run: terraform apply -auto-approve  # applies the previously-reviewed plan
```

Protecting against accidental destroy:

```hcl
# Never lose production data
resource "aws_db_instance" "shopfast" {
  lifecycle {
    prevent_destroy = true   # terraform apply will error if this would be destroyed
  }
}
```

### Common failures & how to debug

| Failure | Symptom | Diagnosis |
|---|---|---|
| State lock stuck | `Error: state is locked` | `terraform force-unlock <lock-id>` — only after confirming no apply is running |
| Drift | Plan shows changes nobody made | Someone used ClickOps; `terraform plan` detects it; `apply` reconciles |
| Replace instead of update | `-/+` in plan for a stateful resource | Read plan carefully; use `moved` block or `terraform state mv` to refactor without destroy |
| Secret in state | `terraform state pull \| grep password` shows plaintext | Don't pass secrets as resource attributes; pull from Secrets Manager at runtime |
| Monolithic state, slow plan | `plan` takes 5 minutes, one `apply` affects everything | Split state by domain/environment; use `targeted apply` (`-target`) sparingly |
| Module version unpinned | `terraform init` pulls a new module version; plan changes | Pin all modules: `source = "…" version = "= 1.4.2"` |
| `terraform destroy` deleted prod DB | Data loss | `prevent_destroy = true`; require approval gate on the apply job; never run `destroy` in prod pipeline |

The most dangerous IaC failure mode: **reading the `plan` output too quickly**. A `-/+` (replace) marker on a database means Terraform will **drop and recreate** it — that is data loss. Senior engineers treat `-/+` on stateful resources as a stop-and-investigate signal, not something to auto-apply.

```bash
# Safe workflow when a plan shows a surprising replace:
terraform plan -out=tfplan
terraform show -json tfplan | jq '.resource_changes[] | select(.change.actions[] == "delete")'
# Lists every resource being deleted — verify intentional before applying
```

### Types & differences

| Tool category | Examples | What it manages | Reach for it when |
|---|---|---|---|
| **Provisioning** | Terraform, CloudFormation, Pulumi | Cloud resources (VMs, networks, DBs, IAM) | Creating/updating/destroying infrastructure (**ShopFast**) |
| **Config management** | Ansible, Chef, Puppet, Salt | Inside of existing machines (packages, files, services) | Configuring VMs when you can't bake a new image |
| **Container orchestration** | Kubernetes, Helm | Running containers at scale | App workloads on top of provisioned infra |
| **GitOps agent** | Argo CD, Flux | K8s desired state from Git | Continuous reconciliation of cluster state |

| IaC style | How it works | Tradeoff |
|---|---|---|
| **Declarative** (Terraform, CloudFormation) | Describe end state; tool computes diff | Idempotent; convergent; harder to express conditionals |
| **Imperative** (shell + `aws cli`, Ansible procedural) | Describe steps | More control; must handle "already exists" yourself; not idempotent |

| Server model | Approach | Tradeoff |
|---|---|---|
| **Mutable / pets** | SSH in and patch running servers | Quick hotfix; leads to drift and snowflakes |
| **Immutable / cattle** | Build new image, replace instance | No drift, easy rollback; every change is a rebuild + deploy |

---

IaC (Infrastructure as Code) means defining and provisioning infrastructure through machine-readable definitions in version control, not by clicking consoles or running ad-hoc commands. Senior signal: understanding **declarative vs imperative**, **state and drift**, **immutable infrastructure**, and how to operate IaC safely at team scale.

---

## 1. Why IaC

- **Reproducibility** — rebuild an identical environment from code; no "works on my cluster".
- **Version control** — infra changes get diffs, PRs (Pull Requests), review, history, blame, and rollback (`git revert`).
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

- **Provisioning** (Terraform, CloudFormation, Pulumi) — creates/updates/destroys cloud *resources* (VMs (Virtual Machines), networks, DBs, IAM (Identity and Access Management)).
- **Configuration management** (Ansible, Chef, Puppet, Salt) — configures the *inside* of existing machines (install packages, manage files/services, set users). 

They compose: Terraform stands up the VMs/network; Ansible (or, increasingly, a baked image) configures them. With immutable infrastructure, config management shrinks because you bake configuration into images instead.

---

## 4. Terraform mechanics (the canonical tool)

- **HCL (HashiCorp Configuration Language)** declarative config; **providers** are plugins that talk to a platform's API (AWS, GCP, Azure, k8s, Datadog…).
- **Resources** = managed objects; **data sources** = read-only lookups; **variables/outputs**; **modules** = reusable, parameterized groups of resources (the unit of DRY (Don't Repeat Yourself) and sharing).
- **The workflow:** `init` (download providers/modules, configure backend) → `plan` (compute the diff: create/update/replace/destroy — **review this**) → `apply` (execute) → `destroy`.
- **The dependency graph:** Terraform builds a DAG (Directed Acyclic Graph) from references between resources and applies in dependency order, parallelizing independent ones.

### State — the single most important concept
Terraform keeps a **state file** mapping your config to real-world resource IDs and caching their attributes. It needs state to know what it manages and to compute diffs.

- **Remote state** (S3 (Simple Storage Service) + DynamoDB lock, Terraform Cloud, GCS (Google Cloud Storage)) is mandatory for teams — local state can't be shared and causes conflicts.
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
- Pairs naturally with auto-scaling groups, blue-green/rolling deploys, and golden AMIs (Amazon Machine Images) / containers.
- **Benefits:** no drift (every instance is identical and disposable), trivial rollback (redeploy the prior image), predictable + testable, easy horizontal scaling.
- **Tradeoffs:** every change is a rebuild+redeploy (no quick SSH hotfix — which is also the point); state must live outside the instance (DBs, volumes, object storage); image build pipeline needed.

---

## 6. Operating IaC at team scale

- **Workspaces / separate state per environment** (or directory-per-env) to isolate dev/staging/prod blast radius.
- **Modules** for reuse + standards; pin module/provider **versions** for reproducibility.
- **CI/CD (Continuous Integration / Continuous Delivery) for IaC:** `plan` on PR (post the diff for review), `apply` on merge with approvals — same gates as app code. Many teams use **Atlantis** or Terraform Cloud for plan/apply automation.
- **Policy as code:** OPA (Open Policy Agent) / Sentinel / `tflint` / `checkov` to enforce guardrails (no public buckets, tagging required, allowed instance types) before apply.
- **Secrets:** never hardcode; pull from a secrets manager/vault; keep them out of state where possible.
- **GitOps** extends the idea: Git is the desired state, an agent continuously reconciles.

---

## Common pitfalls & misconceptions

- **Manual ("ClickOps") changes to managed resources** → drift, confusing plans, reverted changes.
- **Local/unshared state** on a team → conflicts and corruption; use remote state + locking.
- **Not reading the plan** → an apply silently replaces/destroys a stateful resource.
- **Secrets in state or in HCL (HashiCorp Configuration Language)** committed to Git.
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

- **IaC (Infrastructure as Code)** = infra defined in version-controlled code → reproducible, auditable, drift-free, reviewable.
- **Declarative (desired state, idempotent)** dominates; **provisioning** (Terraform) vs **config mgmt** (Ansible).
- **Terraform:** `init → plan → apply`; a **DAG (Directed Acyclic Graph)** of resources; **state** maps config→real resources.
- **State must be remote + locked + encrypted**; **drift** = reality ≠ state, detected by `plan`; don't ClickOps managed resources.
- **Immutable infra:** replace instances via new images instead of patching → no drift, easy rollback, state lives externally.
- **Operate it like app code:** modules, pinned versions, plan-on-PR, policy-as-code, secrets from a vault, per-env state.
