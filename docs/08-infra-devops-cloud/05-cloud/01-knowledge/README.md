# Cloud Core — Knowledge / Study Notes

> Topic: AWS/GCP compute, storage, network, IAM.

[← Topic overview](../README.md)

> **🛒 Where we are in building ShopFast** — Last topic we packaged ShopFast into [containers and deployed them with Kubernetes](../../03-containers/01-knowledge/README.md). Now we need to answer: *where does that Kubernetes cluster actually live?* This topic chooses the cloud primitives — compute, storage, networking, and IAM (Identity and Access Management) — that ShopFast runs on. **Next:** once the cloud is provisioned, we need to understand [Linux & OS internals](../../05-linux-os/01-knowledge/README.md) to diagnose what's happening inside those VMs (Virtual Machines) and containers when things go wrong.

---

## Teaching arc: putting ShopFast in the cloud

### What it is

**Cloud computing** is renting computing infrastructure — servers, storage, networking, databases — over the internet, paying only for what you use, with the ability to scale up or down in minutes.

Analogy: electricity from the grid. Before public electricity, every factory built its own generator — expensive, custom, hard to scale. The electrical grid let factories plug in and pay per kilowatt-hour. Cloud computing is that grid for servers: you plug in (provision), consume what you need, and stop paying when you're done. You don't own the power plant.

### Why we use it

A 4-person ShopFast team launching pre-revenue does not want to:
- Buy and rack physical servers (6–12 week lead time, large upfront cost)
- Manage hardware failures, cooling, and network cabling
- Over-provision for peak traffic (Black Friday) and waste money the rest of the year
- Handle physical data-centre access for disaster recovery

Cloud solves all four: provision in minutes, pay-per-use, elastically autoscale, multi-region DR (Disaster Recovery) from config. The tradeoff: you share infrastructure with others (shared-responsibility model) and accept vendor pricing/lock-in.

### What it looks like

The core building blocks ShopFast uses (AWS examples; GCP equivalents noted):

```
Internet
   │
[Route 53 DNS] ─────────────────────────────────────
   │
[CloudFront CDN]  ← product images, static assets
   │
[ALB — Application Load Balancer]  ← L7, path-based routing, TLS termination
   │
[Public subnet, 2 AZs]
   ├── EKS (Elastic Kubernetes Service) nodes  ← ShopFast pods
   │
[Private subnet, 2 AZs]
   ├── RDS Postgres primary  ← writes (orders, checkout)
   ├── RDS Postgres read replica  ← catalog reads
   ├── ElastiCache Redis  ← session store + product cache (TTL ~60 s)
   └── SQS queue  ← async work (emails, analytics, payment settlement)

[S3]  ← product images, backups, audit logs
[ECR — Elastic Container Registry]  ← Docker images
[IAM — Identity and Access Management]  ← roles for EKS nodes, CI, devs
```

### ShopFast setup

**Region choice:** `us-east-1` (Northern Virginia) — closest to majority of early US users, lowest latency, and has every AWS service available. **Multi-AZ (Availability Zone):** all stateful resources span ≥2 AZs; EKS nodes spread across `us-east-1a` and `us-east-1b`.

**Compute:** EKS (Elastic Kubernetes Service) managed node groups on **On-Demand** instances at launch (predictable cost); add a Spot (Preemptible) node group for stateless background workers (email queue consumers — fault-tolerant and cheap).

**Networking:**

```
VPC (Virtual Private Cloud) CIDR: 10.0.0.0/16

Public subnets  (10.0.1.0/24, 10.0.2.0/24):
  - ALB (Application Load Balancer) only
  - No app servers or databases here

Private subnets (10.0.10.0/24, 10.0.20.0/24):
  - EKS worker nodes
  - RDS Postgres
  - ElastiCache Redis
  - Egress through NAT Gateway (one per AZ for HA)
```

**IAM (Identity and Access Management) — least-privilege roles:**

```json
// EKS node role: allow nodes to pull images from ECR only
{
  "Effect": "Allow",
  "Action": [
    "ecr:GetDownloadUrlForLayer",
    "ecr:BatchGetImage",
    "ecr:GetAuthorizationToken"
  ],
  "Resource": "*"
  // no s3:*, no iam:*, no rds:* — minimal surface
}
```

```json
// CI/CD role (assumed via OIDC from GitHub Actions — no long-lived keys)
{
  "Effect": "Allow",
  "Action": ["ecr:PutImage", "ecr:InitiateLayerUpload"],
  "Resource": "arn:aws:ecr:us-east-1:123456789:repository/shopfast"
}
```

**Storage:**
- Product images → S3 + CloudFront CDN (cached at edge, ~0 origin load for reads)
- DB backups → S3 with versioning + cross-region replication to `us-west-2`
- Postgres → RDS (Relational Database Service) Multi-AZ (auto-failover if primary AZ dies)

### Common failures & how to debug

| Failure | Symptom | Diagnosis |
|---|---|---|
| Single-AZ DB, AZ goes down | RDS unavailable, all orders fail | `aws rds describe-db-instances` → `MultiAZ: false`; enable Multi-AZ |
| Public S3 bucket | Customer data exposed | `aws s3api get-bucket-acl --bucket <name>`; `aws s3api get-bucket-policy`; block public access |
| Wildcard IAM policy | Blast radius if role is compromised | `aws iam simulate-principal-policy` to see effective permissions; lock down |
| Long-lived access key in CI env var | Key leaked in log line | Rotate key immediately; switch to OIDC (OpenID Connect) short-lived token |
| Unexpected egress bill | High data-transfer cost | `Cost Explorer` → filter by `Data Transfer`; ChatOps alert on egress spike |
| Security Group too open | Port 5432 (Postgres) reachable from internet | `aws ec2 describe-security-groups --filters "Name=group-id,Values=sg-..."` |
| Spot reclaim causes order failure | Payment worker dies mid-transaction | Spot interruption notice (2-min warning) → graceful drain; never put stateful/payment work on Spot |
| NAT Gateway missing in one AZ | Private subnet instances in that AZ lose internet | Private subnet route table must point to AZ-local NAT Gateway |

The most common exam question and production footgun: **Security Group vs NACL (Network Access Control List)**.

```
Security Group = stateful, per-instance, ALLOW-only rules
  → return traffic is automatically allowed
  → attach to EC2 / RDS / ELB

NACL = stateless, per-subnet, ALLOW + DENY rules, evaluated in order
  → you must explicitly allow return traffic (ephemeral ports)
  → first matching rule wins
  → use for subnet-level guardrails (e.g., block a known bad CIDR)
```

### Types & differences

| Compute primitive | AWS | GCP | Reach for it when |
|---|---|---|---|
| **VM (Virtual Machine)** | EC2 | Compute Engine | Full OS control, legacy/stateful, custom kernel |
| **Managed containers** | ECS / EKS | Cloud Run / GKE | Containerized services (**ShopFast**) |
| **Serverless / FaaS** | Lambda | Cloud Functions | Event-driven, spiky/low-traffic, glue code |
| **Batch workers** | Batch / SQS | Batch / Pub/Sub | Async processing, fault-tolerant |

| VM pricing model | Cost | Catch | Use when |
|---|---|---|---|
| **On-Demand** | Highest | None | Dev, unpredictable load |
| **Reserved / Savings Plans** | ~40–60% off | 1–3 yr commitment | Steady baseline (**ShopFast prod web tier**) |
| **Spot / Preemptible** | ~70–90% off | 2-min reclaim notice | Stateless, fault-tolerant batch (**ShopFast email workers**) |

| Storage type | AWS | Access pattern | When |
|---|---|---|---|
| **Object** | S3 | HTTP, any client | Blobs, images, backups, logs (**ShopFast images**) |
| **Block** | EBS | Attached to one VM | Databases, filesystems on VMs |
| **File** | EFS | Shared NFS | Multi-instance POSIX access |
| **Managed DB** | RDS / Aurora | SQL | Offload patching/replication (**ShopFast Postgres**) |
| **CDN (Content Delivery Network)** | CloudFront | Edge cache | Static + cacheable content (**ShopFast catalog images**) |

---

Cloud fundamentals span four pillars: **compute, storage, networking, and identity (IAM (Identity and Access Management))**. Senior signal is choosing the right primitive for a workload, reasoning about the shared-responsibility/availability model, and getting IAM right (it's where most breaches live). Examples reference AWS with GCP equivalents noted.

---

## 1. The cloud model

- **Regions** — independent geographic areas (e.g., `us-east-1`). Pick for latency-to-users, data residency/compliance, and cost.
- **Availability Zones (AZs)** — isolated datacenters within a region, separate power/network. **Spread across ≥2 AZs for HA (High Availability)**; a single-AZ deployment dies when that AZ does.
- **Service models:** IaaS (Infrastructure as a Service — VMs/network — you manage OS up), PaaS (Platform as a Service — managed runtime), **serverless/FaaS (Function as a Service)** (managed everything; pay per invocation), SaaS (Software as a Service).
- **Shared responsibility:** the provider secures the cloud (hardware, hypervisor, managed-service internals); **you secure what's in the cloud** (your data, IAM config, OS patching on VMs, app code, network rules). Most breaches are customer misconfigurations (open S3 buckets, over-broad IAM (Identity and Access Management)), not provider failures.
- **Elasticity & pay-per-use** — scale on demand; this is the core economic shift from capex to opex.

---

## 2. Compute

| Primitive | AWS | GCP | When to use |
|---|---|---|---|
| Virtual machines | EC2 | Compute Engine | Full control, legacy/stateful, custom OS |
| Containers (managed) | ECS / EKS | Cloud Run / GKE | Containerized services, microservices |
| Serverless functions | Lambda | Cloud Functions | Event-driven, spiky/low-traffic, glue |
| Batch/queue workers | Batch / SQS-driven | Batch / Pub/Sub | Async processing |

**Pricing/availability models for VMs (Virtual Machines):**
- **On-demand** — pay per second/hour, no commitment. Default; most expensive per unit.
- **Reserved / Savings Plans / Committed Use** — commit 1–3 years for big discounts; for steady baseline load.
- **Spot / Preemptible** — spare capacity at up to ~90% off, **but can be reclaimed with ~2 min notice**. Great for fault-tolerant, interruptible batch/stateless work; never for stateful or latency-critical singletons.

**Auto Scaling Groups / Managed Instance Groups** add/remove instances based on metrics, behind a load balancer, across AZs for HA (High Availability).

**Serverless tradeoffs:** no servers to manage, scales to zero, pay-per-request; but **cold starts** (latency on first/idle invocation), execution time/memory limits, statelessness, and potential vendor lock-in. Ideal for spiky or low-baseline workloads; can be costlier than VMs at sustained high throughput.

---

## 3. Storage — pick by access pattern

- **Object storage** (S3 / Cloud Storage): infinitely scalable, durable (11 nines), HTTP API, cheap. For blobs, backups, static assets, data lakes, logs. **Not** a filesystem; eventual-ish consistency historically (now strong read-after-write on S3). Storage classes (Standard → Infrequent Access → Glacier/Archive) trade retrieval latency/cost; lifecycle policies auto-tier.
- **Block storage** (EBS (Elastic Block Store) / Persistent Disk): a virtual disk attached to *one* VM (mostly), low latency, for databases and filesystems. Provisioned IOPS (Input/Output Operations Per Second) / throughput. Backed up via snapshots.
- **File storage** (EFS (Elastic File System) / Filestore): network filesystem (NFS (Network File System)) shared across many instances. For shared POSIX access; pricier per GB.
- **Managed databases** (RDS (Relational Database Service) / Aurora, Cloud SQL, DynamoDB, Spanner): offload patching, backups, replication, failover. Relational (RDS/Aurora) vs NoSQL key-value/document (DynamoDB) vs globally-distributed (Spanner). Use these over self-hosting on a VM unless you have a strong reason.
- **CDN (Content Delivery Network)** (CloudFront / Cloud CDN): edge caching for static + cacheable dynamic content; reduces latency and origin load.

Durability ≠ availability ≠ backup: object stores are extremely durable, but you still need **versioning + cross-region replication + tested restores** for true protection (against deletes/ransomware).

---

## 4. Networking

- **VPC (Virtual Private Cloud)** — your isolated virtual network with a CIDR (Classless Inter-Domain Routing) block.
- **Subnets** — segments of the VPC, each in **one AZ (Availability Zone)**. **Public subnet** has a route to an Internet Gateway; **private subnet** doesn't (egress via a **NAT Gateway**). Put databases/app servers in private subnets; only load balancers/bastions in public.
- **Route tables** — direct traffic between subnets, gateways, peers.
- **Security Groups** — **stateful** virtual firewalls attached to instances (return traffic auto-allowed); default deny inbound. **NACLs (Network Access Control Lists)** — **stateless**, subnet-level, allow+deny rules, evaluated in order. Know the stateful-vs-stateless distinction.
- **Load balancers** — L7 (ALB (Application Load Balancer) / HTTP-aware: path/host routing, TLS termination) vs L4 (NLB (Network Load Balancer) / TCP: high throughput, static IP). Distribute across AZs.
- **Connectivity:** VPC peering, Transit Gateway (hub), VPN, Direct Connect/Interconnect (private link to on-prem), **PrivateLink** (reach a service without traversing the internet).
- **DNS (Domain Name System)** (Route 53 / Cloud DNS): routing policies (latency, geo, weighted, failover) + health checks.

---

## 5. IAM — identity & access (where breaches live)

- **Principals:** users, **groups**, and **roles** (assumable identities — preferred for workloads/cross-account).
- **Policies:** JSON documents granting/denying actions on resources, optionally with conditions. Evaluation: **explicit deny > explicit allow > default deny**. Identity-based (attached to principal) vs resource-based (attached to the resource, e.g., S3 bucket policy).
- **Least privilege** — grant only the permissions needed; start minimal and add. Avoid wildcard `*` actions/resources in production.
- **Roles over long-lived keys:** give EC2/Lambda/pods a **role** (instance profile / IRSA (IAM Roles for Service Accounts) / Workload Identity) so they get **short-lived, auto-rotated credentials** instead of static access keys baked into config (the #1 leaked-secret source).
- **MFA (Multi-Factor Authentication)** for humans; **root account locked away** (no daily use, MFA, no access keys).
- **Federation/SSO (Single Sign-On)** (SAML (Security Assertion Markup Language) / OIDC (OpenID Connect)) so people use corporate identity, not per-cloud users.
- **Boundaries:** organizations + SCPs (Service Control Policies — guardrails across accounts); separate accounts/projects per environment for blast-radius isolation.

---

## 6. Cost & ops

- **Cost drivers:** compute hours, storage GB-months, **egress/data-transfer** (often a hidden cost — inter-region/internet egress is pricey; same-AZ is cheap), requests, NAT Gateway data processing.
- **Save money:** right-size, commit (reserved/savings plans), spot for interruptible work, lifecycle-tier storage, delete idle resources, cache to cut egress, set budgets/alerts and tagging for attribution.
- **Well-Architected pillars:** operational excellence, security, reliability, performance efficiency, cost optimization, sustainability — a useful checklist framing in interviews.

---

## Common pitfalls & misconceptions

- Single-AZ (Availability Zone) deployments — no HA (High Availability); an AZ outage is an outage.
- Public S3 buckets / over-broad bucket policies — classic data-leak.
- Wildcard IAM (`Action: "*"`, `Resource: "*"`) — massive blast radius.
- Long-lived access keys in code/config instead of roles.
- Confusing Security Groups (stateful, instance) with NACLs (Network Access Control Lists — stateless, subnet).
- Ignoring egress costs in architecture (chatty cross-region/internet traffic).
- Treating high durability as if it were backup — versioning + tested restore still required.
- Putting databases in public subnets.
- Assuming serverless is always cheaper — at sustained high load, VMs (Virtual Machines)/containers win.

---

## What interviewers probe

- Region vs AZ (Availability Zone) and how you achieve HA (High Availability).
- Object vs block vs file storage — pick for a given workload.
- Public vs private subnet, NAT Gateway, and where to place app/db tiers.
- Security Group vs NACL (Network Access Control List — stateful vs stateless).
- IAM (Identity and Access Management) roles vs users vs keys; least privilege; policy evaluation order.
- Spot/preemptible tradeoffs and where they're safe.
- Serverless tradeoffs (cold starts, limits, cost crossover).
- Shared-responsibility model.

---

## Quick-reference summary

- **Region → AZs (Availability Zones);** span ≥2 AZs for HA (High Availability). Provider secures the cloud, **you secure what's in it**.
- **Compute:** VMs (Virtual Machines — full control) → managed containers → serverless (scale-to-zero, cold starts). **Spot** = cheap + interruptible.
- **Storage:** object (blobs, cheap, durable) vs block (one-VM disk, DBs) vs file (shared NFS (Network File System)); prefer **managed DBs**; CDN (Content Delivery Network) at the edge.
- **Network:** VPC (Virtual Private Cloud) → public/private subnets, NAT for private egress; **Security Group = stateful/instance**, **NACL (Network Access Control List) = stateless/subnet**; L7 vs L4 LBs (Load Balancers).
- **IAM (Identity and Access Management):** least privilege, **roles + short-lived creds over static keys**, MFA (Multi-Factor Authentication), lock root; deny > allow > default-deny.
- **Cost:** watch **egress**; commit for baseline, spot for batch, tier storage, set budgets.
