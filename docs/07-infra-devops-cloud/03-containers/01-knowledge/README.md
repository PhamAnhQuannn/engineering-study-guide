# Containers & Orchestration — Knowledge / Study Notes

> Topic: Docker, Kubernetes basics, orchestration.

[← Topic overview](../README.md)

Containers package an application with its dependencies into a portable, isolated unit. Orchestration (Kubernetes) runs many containers across a fleet, keeping them healthy, scaled, and reachable. Senior signal: understanding *what the isolation actually is* (it's not a VM) and *how Kubernetes reconciles desired state*.

---

## 1. What a container really is

A container is **not** a lightweight VM. It's a normal Linux process whose view of the system is constrained by kernel features:

- **Namespaces** — isolate *what a process can see*: PID (its own process tree), NET (own interfaces/ports), MNT (own filesystem mounts), UTS (hostname), IPC, USER (UID mapping), cgroup. The process thinks it's alone on the machine.
- **cgroups (control groups)** — limit and account *how much* a process can use: CPU, memory, I/O, PIDs. This enforces resource limits.
- **Union/overlay filesystem** — layered, copy-on-write image layers stacked into one view, with a thin writable layer on top per container.
- **Capabilities / seccomp / SELinux/AppArmor** — drop kernel privileges and restrict syscalls.

Crucial consequence: **containers share the host kernel.** A VM has its own kernel + hypervisor (stronger isolation, heavier); a container is just isolated processes (lighter, faster start, weaker isolation boundary — a kernel exploit can cross it). Choose VMs when you need hard multi-tenant isolation, containers when you want density and speed.

---

## 2. Images & Dockerfiles

An **image** is an immutable, layered filesystem + metadata (entrypoint, env, exposed ports). A **container** is a running (or stopped) instance of an image with a writable layer. Images are content-addressed by **digest**; tags like `latest` are mutable pointers (avoid in prod — pin digests).

**Layer caching:** each Dockerfile instruction is a layer; Docker caches layers and reuses them if the instruction and its inputs are unchanged. Order matters — put rarely-changing steps (install deps) before frequently-changing ones (copy source) so the cache survives code edits:

```dockerfile
# good: dependencies cached separately from source
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .          # changes rarely
RUN pip install -r requirements.txt
COPY . .                          # changes every commit
CMD ["python", "app.py"]
```

**Multi-stage builds** keep the final image small and free of build tools/secrets:

```dockerfile
FROM golang:1.22 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /app ./cmd/server

FROM gcr.io/distroless/static     # tiny, no shell, smaller attack surface
COPY --from=build /app /app
USER nonroot:nonroot
ENTRYPOINT ["/app"]
```

Image best practices: small base (distroless/alpine/slim), run as **non-root**, pin versions, multi-stage, no secrets in layers (they persist even if deleted later), `.dockerignore`, one concern per container.

`ENTRYPOINT` vs `CMD`: ENTRYPOINT is the executable; CMD is default args (overridable). Containers should run **one foreground process (PID 1)**; signals (SIGTERM) must reach it for graceful shutdown — use an init or `exec` form, not a shell wrapper that swallows signals.

---

## 3. Container networking & storage

- **Bridge / overlay networks**, port mapping (host:container). In Kubernetes each Pod gets its own IP (flat network).
- **Volumes / bind mounts** persist data beyond the container's ephemeral writable layer. Containers are **ephemeral and stateless by design** — anything you want to keep goes in a volume or external store.
- **12-factor**: config via environment, stateless processes, logs to stdout/stderr.

---

## 4. Why orchestration

Running one container is easy. Running hundreds across many nodes — with scheduling, health, scaling, rolling updates, service discovery, and self-healing — needs an orchestrator. **Kubernetes (K8s)** is the de facto standard.

### Control plane vs data plane
- **Control plane:** `kube-apiserver` (the front door + state gateway), `etcd` (consistent key-value store of all cluster state), `scheduler` (places Pods on nodes), `controller-manager` (runs reconciliation loops).
- **Nodes (data plane):** `kubelet` (runs/monitors Pods via a container runtime like containerd), `kube-proxy` (service networking).

### The core idea: declarative reconciliation
You declare **desired state** (YAML manifests); controllers continuously compare desired vs actual and act to converge them. Crash a Pod and the controller recreates it; that's "self-healing." This is the same loop GitOps builds on.

### Key objects
- **Pod** — smallest deployable unit: one or more tightly-coupled containers sharing network + storage. Usually one app container (+ sidecars). Pods are ephemeral and disposable.
- **ReplicaSet** — maintains N replicas of a Pod.
- **Deployment** — declarative manager over ReplicaSets; handles rolling updates and rollbacks (`maxSurge`/`maxUnavailable`).
- **StatefulSet** — for stateful apps needing stable identity + ordered, persistent storage (databases).
- **DaemonSet** — one Pod per node (log/metrics agents).
- **Job / CronJob** — run-to-completion / scheduled tasks.
- **Service** — stable virtual IP + DNS name load-balancing across a set of Pods (ClusterIP internal, NodePort, LoadBalancer external). Solves Pod IP churn.
- **Ingress** — HTTP(S) routing/host+path rules into Services (via an ingress controller).
- **ConfigMap / Secret** — inject config / sensitive data (Secrets are base64, *not* encrypted by default — enable encryption-at-rest + RBAC).
- **Namespace** — logical partition for multi-tenancy/quotas.
- **HPA (Horizontal Pod Autoscaler)** — scales replica count on CPU/memory/custom metrics.

### Health & scheduling
- **Liveness probe** — restart the container if it's wedged.
- **Readiness probe** — remove the Pod from Service endpoints until it can serve (don't send traffic before warm-up).
- **Startup probe** — for slow-starting apps, before liveness kicks in.
- **Requests vs limits** — *requests* inform scheduling (guaranteed share) and *limits* cap usage. Memory over limit → **OOMKilled**; CPU over limit → throttled. QoS classes (Guaranteed/Burstable/BestEffort) affect eviction order.

---

## 5. Common pitfalls & misconceptions

- "Containers are mini-VMs." They share the host kernel; isolation is process-level, not hardware.
- Using `latest` tags — non-reproducible, breaks rollback. Pin digests.
- Running as root in the container (privilege escalation risk). Use non-root + drop capabilities.
- Storing secrets in image layers — they persist even if a later layer "removes" them.
- Treating Pods as pets — they're cattle; design stateless, store state externally.
- Putting unrelated processes in one container — one concern per container; use sidecars or separate Pods.
- No resource limits → noisy-neighbor and node OOM; over-tight limits → constant OOMKills/throttling.
- Missing readiness probe → traffic hits a not-ready Pod during rollout → errors.
- Kubernetes Secrets are not encrypted by default (just base64); secure them explicitly.
- Bloated images from single-stage builds shipping compilers/build deps.

---

## 6. What interviewers probe

- "Container vs VM" — namespaces + cgroups + shared kernel.
- How Docker layer caching works and how to order a Dockerfile.
- Liveness vs readiness probes (and the consequence of confusing them).
- Requests vs limits; what OOMKilled and CPU throttling mean.
- How Kubernetes self-heals (reconciliation loop, desired vs actual).
- Service vs Deployment vs Pod; why you need a Service.
- Deployment (stateless) vs StatefulSet (stateful identity).
- Why not run a database casually in K8s without StatefulSet + persistent volumes.

---

## 7. Quick-reference summary

- **Container = isolated process:** namespaces (what it sees) + cgroups (how much it uses) + overlay FS, **sharing the host kernel**. Lighter than VMs, weaker isolation.
- **Images** are immutable layered FS; **order Dockerfiles** dep-first for cache; **multi-stage + non-root + pinned + small base**.
- **Kubernetes** = declarative desired-state reconciliation. Control plane (apiserver/etcd/scheduler/controllers) + nodes (kubelet/kube-proxy).
- **Pod** (smallest unit) → **ReplicaSet** → **Deployment** (rolling updates); **StatefulSet** for stateful; **Service** gives stable VIP/DNS; **Ingress** routes HTTP.
- **Probes:** liveness (restart), readiness (gate traffic), startup (slow boot).
- **Requests/limits** drive scheduling & caps; over-memory = OOMKilled, over-CPU = throttled.
- **Secrets are base64, not encrypted by default.**
