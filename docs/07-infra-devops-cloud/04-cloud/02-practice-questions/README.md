# Cloud Core — Practice Questions

> Topic: AWS/GCP compute, storage, network, IAM.

[← Topic overview](../README.md)

---

### Q1. What's the difference between a Region and an Availability Zone, and why does it matter?

**Answer:** A **Region** is a geographic area (e.g., `us-east-1`); you choose one for latency to users, data-residency/compliance, and cost. An **Availability Zone (AZ)** is an isolated datacenter within a region with independent power and networking. They matter for **high availability**: deploying across two or more AZs means a single datacenter failure (power, network, fire) doesn't take you down. A single-AZ deployment has no HA — when that AZ fails, you're offline. Multi-region adds disaster recovery and global latency benefits at higher complexity/cost.

---

### Q2. Explain object vs block vs file storage and a use case for each.

**Answer:**
- **Object** (S3 / Cloud Storage): scalable, very durable, HTTP-accessed blobs with metadata; no filesystem semantics. Use for backups, static assets, images, logs, data lakes.
- **Block** (EBS / Persistent Disk): a raw virtual disk attached (usually) to one VM, low latency, formatted with a filesystem. Use for databases and boot volumes.
- **File** (EFS / Filestore): a shared network filesystem (NFS) mountable by many instances with POSIX semantics. Use when multiple servers need shared read/write file access (e.g., legacy apps, shared content).

Pick by access pattern: HTTP blobs → object; one-VM low-latency disk → block; many-VM shared FS → file.

---

### Q3. What's the difference between a public and private subnet, and where do you place your database?

**Answer:** A **public subnet** has a route to an Internet Gateway, so resources can have public IPs and be reached from/reach the internet directly. A **private subnet** has no such route; instances reach the internet for outbound (e.g., updates) only through a **NAT Gateway** and can't be reached inbound from the internet. You place **databases and app servers in private subnets** (no public exposure) and put only internet-facing components — load balancers, bastion hosts — in public subnets. This minimizes attack surface.

---

### Q4. Security Group vs Network ACL — explain to a junior.

**Answer:** Both are virtual firewalls but differ:
- A **Security Group** is attached to an instance (ENI), is **stateful** (if you allow an inbound request, the response is automatically allowed back out), and supports only *allow* rules with a default-deny. Think "firewall around a server."
- A **Network ACL (NACL)** operates at the **subnet** level, is **stateless** (you must explicitly allow both request and response directions), supports both *allow and deny* rules, and evaluates them in numbered order. Think "border guard for a whole subnet."

Use Security Groups as your primary control; use NACLs for coarse subnet-wide deny rules (e.g., block an IP range).

---

### Q5. Why prefer IAM roles over long-lived access keys for application credentials?

**Answer:** Long-lived access keys are static secrets that often get committed to code, leaked in logs, or never rotated — the most common cause of cloud breaches. An **IAM role** assigned to the compute (EC2 instance profile, EKS IRSA, GCP Workload Identity) delivers **short-lived, automatically-rotated credentials** to the application via the metadata service — nothing to store, nothing to leak permanently, and access is scoped to exactly what the role allows. If credentials are ever exposed, they expire quickly.

---

### Q6. What is the principle of least privilege and how does IAM policy evaluation enforce safety?

**Answer:** Least privilege means granting only the permissions a principal actually needs — start minimal, add as required, avoid wildcards. IAM evaluation order helps enforce safety: it's **default-deny** (nothing is allowed unless explicitly granted), an **explicit Allow** grants access, and an **explicit Deny always wins** over any Allow. So you can attach broad allows for productivity but place explicit denies (or permission boundaries/SCPs) as guardrails that can't be overridden — e.g., "deny all actions outside approved regions."

---

### Q7 (MCQ). You have a fault-tolerant batch job that can be safely interrupted and restarted. Which compute pricing model is most cost-effective?

A. On-demand  B. Reserved Instances  C. Spot/Preemptible  D. Dedicated hosts

**Answer: C.** Spot/preemptible instances use spare capacity at up to ~90% off but can be reclaimed with short notice — perfect for interruptible, fault-tolerant batch work. Don't use them for stateful or latency-critical singletons.

---

### Q8 (MCQ). Which is the customer's responsibility under the shared responsibility model on IaaS?

A. Physical datacenter security  B. Hypervisor patching  C. Configuring IAM and patching the guest OS  D. Securing the cloud provider's network backbone

**Answer: C.** The provider secures the underlying cloud (hardware, hypervisor, facilities); the customer secures *in* the cloud — IAM configuration, guest OS patching on VMs, app code, data, and network rules.

---

### Q9 (MCQ). A serverless function has high latency on its first invocation after being idle. This is called:

A. Throttling  B. A cold start  C. Eviction  D. Backpressure

**Answer: B.** A **cold start** is the latency incurred when the platform spins up a new execution environment because none was warm. Mitigations: provisioned concurrency, keeping functions small, periodic warming.

---

### Q10 (MCQ). Which cost is frequently underestimated in cloud architectures?

A. Inbound data transfer  B. Data egress / cross-region transfer  C. Storage at rest  D. CPU seconds

**Answer: B.** Egress (data leaving the cloud or crossing regions) is often the surprise line item. Inbound is typically free; same-AZ traffic is cheap; internet/cross-region egress and NAT data processing add up fast.

---

### Q11. When would you choose serverless (FaaS) over containers/VMs, and when not?

**Answer:** Choose serverless for **spiky, event-driven, or low-baseline** workloads — it scales to zero, you pay per invocation, and there are no servers to manage (great for webhooks, glue, infrequent jobs). Avoid it for **sustained high-throughput** workloads (cost crosses over and dedicated compute becomes cheaper), latency-sensitive paths sensitive to **cold starts**, long-running jobs that exceed execution limits, or workloads needing fine-grained control over the runtime/networking. Lock-in is also higher.

---

### Q12. Why isn't an extremely durable object store (11 nines) the same as having backups?

**Answer:** Durability protects against *hardware/media loss* — the provider won't lose your bytes. But it does nothing against **logical loss**: an accidental delete, a buggy job overwriting data, or ransomware will faithfully and durably destroy/replace your objects. Real protection requires **versioning** (recover prior versions), **lifecycle/retention and object-lock** (immutability), **cross-region replication**, and — critically — **tested restores**. An untested backup is not a backup.
