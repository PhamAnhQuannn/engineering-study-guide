# Cloud Core — System Design Questions

> Topic: AWS/GCP compute, storage, network, IAM.

[← Topic overview](../README.md)

Each prompt is structured: **Requirements/Scale → High-level design → Data model → Scaling & bottlenecks → Tradeoffs & failure modes.** Answers reference AWS with GCP equivalents in parentheses.

---

### DQ1. Design a highly-available 3-tier web application on the cloud

**Requirements/Scale:** Public web app, ~5k RPS peak, 99.95% availability target, must survive an AZ failure, secure data tier, sub-300ms p95.

**High-level design:**
- **Network:** One VPC, ≥2 AZs. Public subnets hold an internet-facing **Application Load Balancer** (ALB / GCLB) + NAT Gateways. Private subnets hold the app tier; isolated private subnets hold the data tier.
- **Web/app tier:** Stateless app servers in an **Auto Scaling Group** (Managed Instance Group) or **ECS/EKS** (GKE/Cloud Run) across both AZs, behind the ALB. Scale on CPU/RPS.
- **Data tier:** **RDS/Aurora Multi-AZ** (Cloud SQL HA) primary + standby in a second AZ with automatic failover; read replicas for read scaling. **ElastiCache/Redis** (Memorystore) for sessions/hot data.
- **Static + media:** **S3** (Cloud Storage) behind **CloudFront** (Cloud CDN). App is stateless → sessions in Redis, not on instances.
- **Edge:** Route 53 (Cloud DNS) + WAF + TLS termination at the ALB.

**Data model:** Relational core (users, orders) in Aurora; session/cache K-V in Redis; blobs (uploads, assets) in S3 keyed by ID; CDN caches static + cacheable API responses.

**Scaling & bottlenecks:** App tier scales horizontally (stateless). DB writes are the bottleneck — mitigate with read replicas, caching, and connection pooling (RDS Proxy / PgBouncer). CDN offloads static + egress.

**Tradeoffs & failure modes:** Multi-AZ doubles DB cost for standby but survives AZ loss. AZ failure → ASG reschedules in healthy AZ, DB fails over (brief blip). Region failure not covered unless you add cross-region replicas/DR. Cache stampede risk on cold cache — add request coalescing/jitter.

---

### DQ2. Design secure, scalable storage and serving for user-uploaded files (e.g., image/video uploads)

**Requirements/Scale:** Millions of users uploading photos/videos, global delivery, private per-user files, virus/size validation, cost-efficient at PB scale.

**High-level design:**
- Clients upload **directly to S3** (Cloud Storage) via **pre-signed URLs** issued by the API — bytes never flow through your servers (saves compute/egress and scales infinitely).
- **CloudFront** (Cloud CDN) in front of S3 with **signed URLs/cookies** + Origin Access Control so the bucket itself stays private.
- An **S3 event → Lambda** (GCS notification → Cloud Function) pipeline runs validation, virus scan, thumbnail/transcode (Lambda → MediaConvert for video).
- **Lifecycle policies** tier old/cold objects to Infrequent-Access → Glacier (Coldline/Archive). **Versioning + replication** for durability.

**Data model:** Object key namespaced by user/asset ID; metadata (owner, status, size, content-type, scan result) in a database (DynamoDB/Postgres) — never list-the-bucket for metadata. Signed URLs are time-limited.

**Scaling & bottlenecks:** S3 scales to effectively unlimited throughput by key prefix distribution; direct-to-S3 uploads remove the app as a bottleneck. CDN absorbs read traffic and egress.

**Tradeoffs & failure modes:** Pre-signed URLs must be tightly scoped (method, key, expiry, size) or they're an abuse vector. Async processing means a brief window where an upload exists but isn't yet validated/thumbnailed — model "pending" state. Bucket misconfiguration = data leak; enforce block-public-access + bucket policies + access logging.

---

### DQ3. Design a multi-account/multi-environment landing zone with least-privilege IAM

**Requirements/Scale:** A growing org with dev/staging/prod, multiple teams, compliance needs, blast-radius isolation, and central guardrails.

**High-level design:**
- **Separate accounts** (GCP projects) per environment and per team/workload, under an **Organization**. Isolation means a compromised dev account can't touch prod.
- **Service Control Policies** (Org Policies) as org-wide guardrails — e.g., deny region usage outside approved regions, deny disabling logging, deny root key creation. These cap *maximum* permissions regardless of account-level grants.
- **SSO/federation** (IAM Identity Center / Workload Identity Federation) so humans authenticate via corporate IdP and assume **roles** per account; no per-account users or static keys.
- **Workloads assume roles** (instance profiles / IRSA / Workload Identity) for short-lived creds. **Permission boundaries** cap what a delegated admin can grant.
- **Centralized logging** (CloudTrail/Config → a dedicated logging account) and a security account for GuardDuty/Security Hub.

**Data model (of access):** Principal → assumes Role → Policy (allow) ∩ Permission Boundary ∩ SCP → effective permissions; explicit deny anywhere wins.

**Scaling & bottlenecks:** New team = new account from a vended template (Control Tower / Landing Zone). The bottleneck is policy sprawl — manage IAM as code (Terraform), review, and use access analyzers to prune unused permissions.

**Tradeoffs & failure modes:** Many accounts add operational overhead vs strong isolation. Over-broad SCP can block legitimate work; over-narrow leaves gaps. Misconfigured trust policy on a role = privilege escalation/cross-account risk — review role trust relationships carefully.

---

### DQ4. Design a cost-optimized batch data-processing pipeline

**Requirements/Scale:** Nightly + ad-hoc processing of large datasets (TBs), tolerant to interruption, minimize cost, results queryable.

**High-level design:**
- **Ingest** raw data to **S3** (Cloud Storage) as the data lake (cheap, durable).
- **Compute** on **Spot/Preemptible** instances or managed batch (AWS Batch / EMR on Spot / Dataproc preemptible / serverless Glue / Dataflow). Work is checkpointed and re-runnable so reclaimed instances don't lose progress.
- **Orchestrate** with Step Functions / managed Airflow (Cloud Composer) — retries, fan-out/fan-in.
- **Output** to partitioned S3 (Parquet) queryable by **Athena** (BigQuery), or load into a warehouse (Redshift/BigQuery).
- **Lifecycle-tier** raw data to Glacier after N days.

**Data model:** Lake organized by `dataset/date=YYYY-MM-DD/` partitions in columnar Parquet for cheap scans; a catalog (Glue/Data Catalog) for schema.

**Scaling & bottlenecks:** Horizontal across many Spot workers; bottleneck is shuffle/IO and Spot reclamation. Partitioning + columnar format cut scan cost dramatically.

**Tradeoffs & failure modes:** Spot reclamation requires idempotent, checkpointed jobs (the cost-saving tradeoff). Egress/cross-region scans cost money — keep compute and data co-located. A poison record can fail a whole batch — dead-letter and isolate. Use budgets/alerts to catch runaway scans.
