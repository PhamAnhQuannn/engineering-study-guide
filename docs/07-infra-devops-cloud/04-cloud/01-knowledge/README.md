# Cloud Core — Knowledge / Study Notes

> Topic: AWS/GCP compute, storage, network, IAM.

[← Topic overview](../README.md)

Cloud fundamentals span four pillars: **compute, storage, networking, and identity (IAM)**. Senior signal is choosing the right primitive for a workload, reasoning about the shared-responsibility/availability model, and getting IAM right (it's where most breaches live). Examples reference AWS with GCP equivalents noted.

---

## 1. The cloud model

- **Regions** — independent geographic areas (e.g., `us-east-1`). Pick for latency-to-users, data residency/compliance, and cost.
- **Availability Zones (AZs)** — isolated datacenters within a region, separate power/network. **Spread across ≥2 AZs for HA**; a single-AZ deployment dies when that AZ does.
- **Service models:** IaaS (VMs/network — you manage OS up), PaaS (managed runtime), **serverless/FaaS** (managed everything; pay per invocation), SaaS.
- **Shared responsibility:** the provider secures the cloud (hardware, hypervisor, managed-service internals); **you secure what's in the cloud** (your data, IAM config, OS patching on VMs, app code, network rules). Most breaches are customer misconfigurations (open S3 buckets, over-broad IAM), not provider failures.
- **Elasticity & pay-per-use** — scale on demand; this is the core economic shift from capex to opex.

---

## 2. Compute

| Primitive | AWS | GCP | When to use |
|---|---|---|---|
| Virtual machines | EC2 | Compute Engine | Full control, legacy/stateful, custom OS |
| Containers (managed) | ECS / EKS | Cloud Run / GKE | Containerized services, microservices |
| Serverless functions | Lambda | Cloud Functions | Event-driven, spiky/low-traffic, glue |
| Batch/queue workers | Batch / SQS-driven | Batch / Pub/Sub | Async processing |

**Pricing/availability models for VMs:**
- **On-demand** — pay per second/hour, no commitment. Default; most expensive per unit.
- **Reserved / Savings Plans / Committed Use** — commit 1–3 years for big discounts; for steady baseline load.
- **Spot / Preemptible** — spare capacity at up to ~90% off, **but can be reclaimed with ~2 min notice**. Great for fault-tolerant, interruptible batch/stateless work; never for stateful or latency-critical singletons.

**Auto Scaling Groups / Managed Instance Groups** add/remove instances based on metrics, behind a load balancer, across AZs for HA.

**Serverless tradeoffs:** no servers to manage, scales to zero, pay-per-request; but **cold starts** (latency on first/idle invocation), execution time/memory limits, statelessness, and potential vendor lock-in. Ideal for spiky or low-baseline workloads; can be costlier than VMs at sustained high throughput.

---

## 3. Storage — pick by access pattern

- **Object storage** (S3 / Cloud Storage): infinitely scalable, durable (11 nines), HTTP API, cheap. For blobs, backups, static assets, data lakes, logs. **Not** a filesystem; eventual-ish consistency historically (now strong read-after-write on S3). Storage classes (Standard → Infrequent Access → Glacier/Archive) trade retrieval latency/cost; lifecycle policies auto-tier.
- **Block storage** (EBS / Persistent Disk): a virtual disk attached to *one* VM (mostly), low latency, for databases and filesystems. Provisioned IOPS/throughput. Backed up via snapshots.
- **File storage** (EFS / Filestore): network filesystem (NFS) shared across many instances. For shared POSIX access; pricier per GB.
- **Managed databases** (RDS/Aurora, Cloud SQL, DynamoDB, Spanner): offload patching, backups, replication, failover. Relational (RDS/Aurora) vs NoSQL key-value/document (DynamoDB) vs globally-distributed (Spanner). Use these over self-hosting on a VM unless you have a strong reason.
- **CDN** (CloudFront / Cloud CDN): edge caching for static + cacheable dynamic content; reduces latency and origin load.

Durability ≠ availability ≠ backup: object stores are extremely durable, but you still need **versioning + cross-region replication + tested restores** for true protection (against deletes/ransomware).

---

## 4. Networking

- **VPC (Virtual Private Cloud)** — your isolated virtual network with a CIDR block.
- **Subnets** — segments of the VPC, each in **one AZ**. **Public subnet** has a route to an Internet Gateway; **private subnet** doesn't (egress via a **NAT Gateway**). Put databases/app servers in private subnets; only load balancers/bastions in public.
- **Route tables** — direct traffic between subnets, gateways, peers.
- **Security Groups** — **stateful** virtual firewalls attached to instances (return traffic auto-allowed); default deny inbound. **NACLs** — **stateless**, subnet-level, allow+deny rules, evaluated in order. Know the stateful-vs-stateless distinction.
- **Load balancers** — L7 (ALB/HTTP-aware: path/host routing, TLS termination) vs L4 (NLB/TCP: high throughput, static IP). Distribute across AZs.
- **Connectivity:** VPC peering, Transit Gateway (hub), VPN, Direct Connect/Interconnect (private link to on-prem), **PrivateLink** (reach a service without traversing the internet).
- **DNS** (Route 53 / Cloud DNS): routing policies (latency, geo, weighted, failover) + health checks.

---

## 5. IAM — identity & access (where breaches live)

- **Principals:** users, **groups**, and **roles** (assumable identities — preferred for workloads/cross-account).
- **Policies:** JSON documents granting/denying actions on resources, optionally with conditions. Evaluation: **explicit deny > explicit allow > default deny**. Identity-based (attached to principal) vs resource-based (attached to the resource, e.g., S3 bucket policy).
- **Least privilege** — grant only the permissions needed; start minimal and add. Avoid wildcard `*` actions/resources in production.
- **Roles over long-lived keys:** give EC2/Lambda/pods a **role** (instance profile / IRSA / Workload Identity) so they get **short-lived, auto-rotated credentials** instead of static access keys baked into config (the #1 leaked-secret source).
- **MFA** for humans; **root account locked away** (no daily use, MFA, no access keys).
- **Federation/SSO** (SAML/OIDC) so people use corporate identity, not per-cloud users.
- **Boundaries:** organizations + Service Control Policies (guardrails across accounts); separate accounts/projects per environment for blast-radius isolation.

---

## 6. Cost & ops

- **Cost drivers:** compute hours, storage GB-months, **egress/data-transfer** (often a hidden cost — inter-region/internet egress is pricey; same-AZ is cheap), requests, NAT Gateway data processing.
- **Save money:** right-size, commit (reserved/savings plans), spot for interruptible work, lifecycle-tier storage, delete idle resources, cache to cut egress, set budgets/alerts and tagging for attribution.
- **Well-Architected pillars:** operational excellence, security, reliability, performance efficiency, cost optimization, sustainability — a useful checklist framing in interviews.

---

## Common pitfalls & misconceptions

- Single-AZ deployments — no HA; an AZ outage is an outage.
- Public S3 buckets / over-broad bucket policies — classic data-leak.
- Wildcard IAM (`Action: "*"`, `Resource: "*"`) — massive blast radius.
- Long-lived access keys in code/config instead of roles.
- Confusing Security Groups (stateful, instance) with NACLs (stateless, subnet).
- Ignoring egress costs in architecture (chatty cross-region/internet traffic).
- Treating high durability as if it were backup — versioning + tested restore still required.
- Putting databases in public subnets.
- Assuming serverless is always cheaper — at sustained high load, VMs/containers win.

---

## What interviewers probe

- Region vs AZ and how you achieve HA.
- Object vs block vs file storage — pick for a given workload.
- Public vs private subnet, NAT Gateway, and where to place app/db tiers.
- Security Group vs NACL (stateful vs stateless).
- IAM roles vs users vs keys; least privilege; policy evaluation order.
- Spot/preemptible tradeoffs and where they're safe.
- Serverless tradeoffs (cold starts, limits, cost crossover).
- Shared-responsibility model.

---

## Quick-reference summary

- **Region → AZs;** span ≥2 AZs for HA. Provider secures the cloud, **you secure what's in it**.
- **Compute:** VMs (control) → managed containers → serverless (scale-to-zero, cold starts). **Spot** = cheap + interruptible.
- **Storage:** object (blobs, cheap, durable) vs block (one-VM disk, DBs) vs file (shared NFS); prefer **managed DBs**; CDN at the edge.
- **Network:** VPC → public/private subnets, NAT for private egress; **Security Group = stateful/instance**, **NACL = stateless/subnet**; L7 vs L4 LBs.
- **IAM:** least privilege, **roles + short-lived creds over static keys**, MFA, lock root; deny > allow > default-deny.
- **Cost:** watch **egress**; commit for baseline, spot for batch, tier storage, set budgets.
