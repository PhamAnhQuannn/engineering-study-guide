# Containers & Orchestration — Practice Questions

> Topic: Docker, Kubernetes basics, orchestration.

[← Topic overview](../README.md)

---

### Q1. How is a container different from a virtual machine?

**Answer:** A VM virtualizes hardware: each VM runs its own full OS kernel on top of a hypervisor — strong isolation, but heavy (GBs, slow boot). A container is just a host process whose view is constrained by Linux **namespaces** (isolating what it sees: PID, network, mounts, hostname) and **cgroups** (limiting what it uses: CPU, memory, I/O). Containers **share the host kernel**, so they're tiny and start in milliseconds, but the isolation boundary is weaker — a kernel vulnerability can cross it. Use VMs for hard multi-tenant isolation; containers for density and speed.

---

### Q2. Explain Docker layer caching and how to write a Dockerfile to exploit it.

**Answer:** Each instruction in a Dockerfile creates a layer. Docker caches layers and reuses a cached layer if that instruction and its inputs are unchanged; once a layer's cache is invalidated, every subsequent layer rebuilds. So order from least- to most-frequently-changing: copy and install dependencies *before* copying application source. Then editing code only invalidates the final `COPY . .` layer, and the expensive dependency-install layer stays cached, making rebuilds fast.

---

### Q3. What problem do multi-stage builds solve?

**Answer:** They let you use a heavy build image (compilers, SDKs, dev dependencies) to produce an artifact, then copy *only that artifact* into a minimal final image. The final image ships without build tools or source, so it's smaller, has a smaller attack surface, and never bakes build-time secrets into a layer. Example: build a Go binary in `golang:1.22`, then `COPY --from=build` it into `distroless/static` and run as non-root.

---

### Q4. Explain liveness vs readiness probes to a junior, and what happens if you confuse them.

**Answer:** A **readiness** probe answers "can this Pod serve traffic right now?" — if it fails, Kubernetes pulls the Pod out of the Service's load-balancing endpoints but doesn't kill it (e.g., during warm-up or a transient dependency blip). A **liveness** probe answers "is this container wedged and needs restarting?" — if it fails, Kubernetes kills and restarts the container. Confusing them is dangerous: if you make a slow-warming app's liveness probe too aggressive, K8s will kill it before it ever starts (a crash loop). If you skip readiness, traffic hits Pods before they're ready and users get errors during rollouts. Use a **startup** probe for slow boots.

---

### Q5. What are resource requests and limits, and what is OOMKilled?

**Answer:** A **request** is the amount of CPU/memory the scheduler reserves for the container — it's used to decide which node has room, and it's the guaranteed share. A **limit** is the hard ceiling. If a container exceeds its **memory** limit, the kernel kills it and Kubernetes marks it **OOMKilled** (out of memory). If it exceeds its **CPU** limit, it's **throttled** (slowed), not killed. Setting requests/limits correctly prevents noisy-neighbor problems and node-level OOM; setting them too tight causes constant OOMKills or throttling.

---

### Q6. How does Kubernetes "self-heal"? Describe the reconciliation loop.

**Answer:** Kubernetes is declarative: you submit the *desired state* (e.g., "3 replicas of this Deployment"). Controllers run continuous control loops that compare desired state (in etcd) against actual cluster state and take action to converge them. If a Pod crashes or a node dies, the actual count drops below desired, so the controller schedules replacement Pods. No human or imperative script is involved — the system continuously drives reality toward the declared spec. This same loop underpins GitOps.

---

### Q7 (MCQ). Which Kubernetes object provides a stable virtual IP and DNS name to load-balance across a changing set of Pods?

A. Deployment  B. Service  C. ReplicaSet  D. ConfigMap

**Answer: B.** Pods are ephemeral and their IPs change; a **Service** gives a stable ClusterIP/DNS name and load-balances to the current healthy Pods (selected by labels).

---

### Q8 (MCQ). Which provides isolation of *what a process can see* (its own PID tree, network, mounts)?

A. cgroups  B. namespaces  C. seccomp  D. overlayfs

**Answer: B.** **Namespaces** isolate visibility (PID/NET/MNT/UTS/IPC/USER). **cgroups** limit resource *consumption*; seccomp filters syscalls; overlayfs provides the layered filesystem.

---

### Q9 (MCQ). You need to run a clustered database with stable network identity and persistent per-replica storage. Which object?

A. Deployment  B. DaemonSet  C. StatefulSet  D. Job

**Answer: C.** A **StatefulSet** gives each replica a stable name/identity and its own persistent volume with ordered, predictable startup/shutdown — what stateful systems need. Deployments treat Pods as interchangeable.

---

### Q10 (MCQ). A Kubernetes `Secret` by default is:

A. Encrypted with the cluster CA  B. Base64-encoded, not encrypted  C. Stored only in memory  D. Encrypted per-namespace

**Answer: B.** Secrets are merely base64-encoded in etcd by default — that's encoding, not encryption. You must enable encryption-at-rest and lock down RBAC/etcd access to actually protect them.

---

### Q11. Why are containers designed to be ephemeral and stateless, and where does state go?

**Answer:** A container's writable layer is destroyed when the container is removed, and orchestrators freely kill, reschedule, and replace Pods (the "cattle not pets" model that enables self-healing, scaling, and rolling updates). So you must not keep important data inside the container. State goes to **volumes / persistent volumes** or external stores (managed databases, object storage, caches). Designing stateless app processes is also a 12-factor principle that makes horizontal scaling trivial.

---

### Q12. Why run a container as a non-root user, and name two other image-hardening practices.

**Answer:** If a process runs as root inside the container and an attacker escapes the container or exploits a shared-kernel bug, root-in-container can become root-on-host or enable broader damage; least privilege limits the blast radius. Other hardening: (1) use a **minimal/distroless base image** (no shell, fewer packages = smaller attack surface), (2) **pin image digests** rather than `latest` for reproducibility, plus drop Linux capabilities, set a read-only root filesystem, and never bake secrets into layers (they persist even if a later layer deletes them).
