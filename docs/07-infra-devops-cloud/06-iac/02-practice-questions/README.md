# Infrastructure as Code — Practice Questions

> Topic: Terraform, config management, immutable infra.

[← Topic overview](../README.md)

---

### Q1. What is Infrastructure as Code and what problems does it solve?

**Answer:** IaC means defining and provisioning infrastructure through version-controlled, machine-readable definitions instead of manual console clicks or ad-hoc scripts. It solves: **reproducibility** (rebuild identical environments from code), **drift/snowflakes** (manual changes diverging environments and unique un-reproducible servers), **auditability** (every change is a reviewed, attributable commit with history and rollback), **consistency** (dev/staging/prod from the same modules), and **disaster recovery** (re-provision from code). It brings software-engineering discipline — review, versioning, testing — to infrastructure.

---

### Q2. Declarative vs imperative IaC — explain to a junior.

**Answer:** **Imperative** means you write the *steps*: "create this VM, then attach this disk, then open this port" — like a recipe; you must handle what happens if a step already ran. **Declarative** means you describe the *desired end state*: "I want one VM with this disk and this port open," and the tool figures out the actions needed to get there. Declarative tools (Terraform, CloudFormation) are **idempotent** — running them repeatedly converges to the same result without duplicating things — which is exactly what you want for reliable, repeatable infrastructure. That's why most modern IaC is declarative.

---

### Q3. What is Terraform state and why does it need to be remote and locked?

**Answer:** State is a file mapping your configuration to the real resources Terraform created (their IDs and cached attributes). Terraform needs it to know what it manages and to compute the diff between desired config and reality. On a team, **local state can't be shared** — two engineers would have divergent views and clobber each other. So you use **remote state** (S3+DynamoDB, GCS, Terraform Cloud) so everyone shares one source of truth, plus **state locking** so two `apply`s can't run simultaneously and corrupt it. State also often contains secrets in plaintext, so it must be encrypted at rest with restricted access.

---

### Q4. What is configuration drift and how does Terraform handle it?

**Answer:** Drift is when the real infrastructure diverges from what's declared in code — typically because someone made a manual change in the cloud console ("ClickOps"). Terraform detects drift during `terraform plan`: it refreshes the actual state of resources and shows the difference against your config. Running `apply` then **reconciles reality back to the code** (reverting the manual change). The lesson: don't manually modify resources Terraform manages — either make the change in code, or your fix gets wiped on the next apply. Persistent drift is a sign of process gaps (no enforced IaC-only policy).

---

### Q5. What is immutable infrastructure and what are its tradeoffs?

**Answer:** Immutable infrastructure means you **never modify a running server** — to make any change, you build a new machine image and replace the instance, rather than SSHing in to patch it. Benefits: **no configuration drift** (every instance is identical and disposable — "cattle not pets"), **trivial rollback** (redeploy the previous image), predictable and testable deployments, and easy horizontal scaling. Tradeoffs: every change requires an image build + redeploy (no quick hotfix — though that discipline is part of the value), you need an image-build pipeline (e.g., Packer/Docker), and **state must live outside the instance** (databases, persistent volumes, object storage) since instances are disposable.

---

### Q6. What is the difference between provisioning tools and configuration management tools?

**Answer:** **Provisioning** tools (Terraform, CloudFormation, Pulumi) create and manage cloud *resources* — VMs, networks, load balancers, databases, IAM. **Configuration management** tools (Ansible, Chef, Puppet) configure the *inside* of machines that already exist — installing packages, managing files and services, setting up users. They complement each other: Terraform stands up the infrastructure, then Ansible configures it. With immutable infrastructure the config-management role shrinks because configuration is baked into the image at build time instead of applied to live servers.

---

### Q7 (MCQ). Which Terraform command shows what changes will be made without applying them?

A. `terraform init`  B. `terraform plan`  C. `terraform apply`  D. `terraform state`

**Answer: B.** `plan` computes and displays the diff (create/update/replace/destroy) so you can review before `apply` executes it. Always read the plan, especially for replace (`-/+`) and destroy actions.

---

### Q8 (MCQ). A `terraform plan` shows a resource will be replaced (`-/+`). What's the risk?

A. None, it's just an update  
B. The resource is destroyed and recreated, which can cause downtime or data loss  
C. The state file is deleted  
D. Providers are re-downloaded

**Answer: B.** A change to an immutable attribute forces a destroy-then-create. For stateful resources (databases, volumes) this can mean downtime or data loss — review replacement plans carefully and protect prod with `prevent_destroy`.

---

### Q9 (MCQ). What makes declarative IaC "idempotent"?

A. It runs faster each time  
B. Applying the same config repeatedly converges to the same end state without duplicating resources  
C. It never changes anything  
D. It requires no state

**Answer: B.** Idempotency means re-applying the desired state is safe and converges — the tool only acts on the difference between desired and actual, so running twice doesn't create duplicates.

---

### Q10 (MCQ). The recommended way to handle secrets (e.g., a DB password) in Terraform is:

A. Hardcode them in the `.tf` files  
B. Store them in the committed state file  
C. Pull them from a secrets manager/vault at runtime and keep them out of committed code/state  
D. Put them in a public module

**Answer: C.** Never hardcode or commit secrets; source them from a secrets manager (and remember state can hold them in plaintext, so encrypt and restrict state access).

---

### Q11. How would you bring an existing, manually-created cloud resource under Terraform management?

**Answer:** Use `terraform import` (or `import` blocks): write the matching resource definition in HCL, then import the existing resource's real ID into Terraform state so Terraform now tracks it. After import, run `terraform plan` and iterate on the HCL until the plan shows **no changes** — meaning your code accurately reflects reality. From then on it's managed as code. This is the standard path for adopting IaC over a hand-built environment ("brownfield"). For renaming/restructuring without destroying, use `state mv` or `moved` blocks.

---

### Q12. Why should IaC changes go through the same CI/CD and review process as application code?

**Answer:** Infrastructure changes are high-blast-radius — a bad apply can delete a database or open a security hole. Treating IaC as code means: **`plan` on every PR** (so reviewers see the exact diff and catch destroys/replaces), **`apply` only on merge** with approvals, **policy-as-code** gates (checkov/OPA/Sentinel) enforcing rules like "no public buckets" or "required tags" before apply, pinned provider/module versions for reproducibility, and a full audit trail. This brings review, testing, and rollback discipline to infrastructure and prevents the unreviewed manual changes that cause outages and drift.
