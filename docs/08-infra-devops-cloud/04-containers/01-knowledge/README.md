# Containers & Orchestration — Knowledge / Study Notes

> Topic: Docker, Kubernetes basics, orchestration.

[← Topic overview](../README.md)

> **🛒 Where we are in building ShopFast** — Last topic we built a [CI/CD (Continuous Integration / Continuous Delivery) pipeline](../../02-cicd/01-knowledge/README.md) that produces a deployable artifact on every green merge. Now we need that artifact to run identically on every engineer's laptop, in staging, and in production — and we need to manage dozens of running copies with zero-downtime deploys and self-healing. **Next:** those containers need a home in the cloud — that's [Cloud Core](../../04-cloud/01-knowledge/README.md).

---

## Teaching arc: packaging and running ShopFast

### What it is

A **container** is a portable, isolated package that bundles your application code together with every library and config it needs to run — but shares the host machine's operating-system kernel.

Analogy: a shipping container. Before shipping containers, every port unloaded cargo differently — ropes here, cranes there, different box sizes everywhere. A shipping container is a *standard box*: the same box loads onto a truck, a ship, or a train without modification. Docker containers are the same idea for software: your app is packed once and runs the same way on a MacBook, a CI server, or an AWS EC2 instance — because the environment travels with the code.

**Orchestration** (Kubernetes) is the port authority: it decides which ship (node) gets which container, restarts a container if it falls overboard, and scales up a fleet of containers when demand spikes.

### Why we use it

Without containers the ShopFast team hits these problems:

- **"Node 18.12 on my Mac, 18.4 in prod"** — subtle runtime differences cause bugs that are impossible to reproduce locally.
- **"The deploy script runs 14 manual steps"** — no reproducibility; one missed step breaks the deploy.
- **"Staging is one server; prod is three; they're configured differently by hand"** — classic snowflake-server drift.
- **Scaling is manual** — when the product page goes viral, someone has to SSH in and start more processes.

Containers solve the first three (consistent, portable runtime); Kubernetes solves the fourth (automated scheduling, scaling, self-healing).

### What it looks like

A minimal but production-ready Dockerfile for ShopFast's Node.js monolith:

```dockerfile
# Stage 1: build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./              # copy lockfile first — cache this layer
RUN npm ci --only=production       # deterministic, cached until lockfile changes
COPY . .
RUN npm run build                  # compile TypeScript → dist/

# Stage 2: run (tiny image — no compiler, no dev deps, no npm)
FROM node:20-alpine
WORKDIR /app
RUN addgroup -S shopfast && adduser -S shopfast -G shopfast  # non-root user
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER shopfast                      # never run as root in prod
EXPOSE 8080
CMD ["node", "dist/index.js"]      # exec form so SIGTERM reaches node, not a shell
```

Running locally:

```bash
docker build -t shopfast:dev .
docker run -p 8080:8080 \
  -e DATABASE_URL=postgres://... \  # config via env, never baked into the image
  shopfast:dev
```

### ShopFast setup

ShopFast runs on **Kubernetes (K8s)** in production. The Deployment manifest for the monolith:

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shopfast
spec:
  replicas: 3                        # 3 pods across AZs (Availability Zones) for HA
  selector:
    matchLabels:
      app: shopfast
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1                    # spin up 1 extra during rollout
      maxUnavailable: 0              # never reduce capacity below 3
  template:
    spec:
      containers:
        - name: shopfast
          image: registry.shopfast.io/shopfast:abc123  # pinned SHA, not :latest
          ports:
            - containerPort: 8080
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:         # pull from K8s Secret, not hardcoded
                  name: shopfast-db
                  key: url
          resources:
            requests:
              cpu: "250m"            # scheduler reserves this on the node
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"        # OOM (Out of Memory) kill if exceeded
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5         # remove pod from Service until /healthz → 200
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 10        # restart pod if it wedges
```

A **Service** gives the Deployment a stable DNS name inside the cluster:

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: shopfast
spec:
  selector:
    app: shopfast
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP   # internal only; Ingress routes external traffic in
```

### Common failures & how to debug

| Failure | Symptom | Diagnosis command |
|---|---|---|
| Pod stuck in `CrashLoopBackOff` | Keeps restarting | `kubectl logs <pod> --previous` (see last crash output) |
| `OOMKilled` | Pod restarts with exit code 137 | `kubectl describe pod <pod>` → `OOMKilled`; increase memory limit or find leak |
| `ImagePullBackOff` | Pod can't start | `kubectl describe pod <pod>` → registry credentials or tag/digest wrong |
| Traffic hits pod before it's ready | 502/503 errors during rollout | Missing or wrong readiness probe path/port |
| Liveness probe too aggressive | Pod restarts during slow GC pauses | Increase `failureThreshold` or use startupProbe for slow-starting apps |
| CPU throttling | High latency but not OOM | `kubectl top pod`; `requests` too low relative to actual use — throttling ≠ OOM |
| Secrets in image layer | `docker history <image>` shows plaintext | Never `ENV SECRET=...` or `RUN export SECRET=...` in Dockerfile; use K8s Secret injection |
| `latest` tag rollback fails | Can't roll back to "previous" | `latest` is mutable; pin to `image:$GIT_SHA`; use `kubectl rollout undo` with digest |

The most dangerous misconception: **confusing liveness and readiness probes**.

- If your *readiness* probe fails → pod is removed from Service endpoints → no traffic (correct during boot/overload).
- If your *liveness* probe fails → pod is **restarted** → you restart a pod that's merely slow, making a cascade worse.

A liveness probe that's too sensitive will *amplify* an overload event by restarting healthy pods mid-request.

```bash
# Common debug loop
kubectl get pods                          # see pod state
kubectl describe pod <name>               # events, probe failures, OOMKilled reason
kubectl logs <name> --previous            # last crash output
kubectl exec -it <name> -- sh             # interactive shell to poke around
kubectl top pods                          # live CPU/memory vs limits
```

### Types & differences

| Thing | What it is | Reach for it when |
|---|---|---|
| **Deployment** | Stateless replicas, rolling updates | Web servers, API services (**ShopFast monolith**) |
| **StatefulSet** | Stable network identity + ordered persistent storage | Databases, Kafka, anything with per-instance state |
| **DaemonSet** | One pod per node | Log shippers, metrics agents, node-local proxies |
| **Job / CronJob** | Run to completion / scheduled | DB migrations, batch jobs, report generation |
| **HPA (Horizontal Pod Autoscaler)** | Scale replica count on metrics | Autoscale ShopFast pods on CPU or custom metric |

| Container isolation | How it works | Tradeoff |
|---|---|---|
| **Container** | Namespaces + cgroups + shared kernel | Light, fast, weaker isolation (kernel exploit crosses) |
| **VM (Virtual Machine)** | Full separate kernel + hypervisor | Stronger isolation, heavier, slower startup |
| **gVisor / Kata** | Container-level API, VM-level isolation | Best of both; overhead between the two |

---

Containers package an application with its dependencies into a portable, isolated unit. Orchestration (Kubernetes) runs many containers across a fleet, keeping them healthy, scaled, and reachable. Senior signal: understanding *what the isolation actually is* (it's not a VM) and *how Kubernetes reconciles desired state*.

---

## 1. What a container really is

A container is **not** a lightweight VM (Virtual Machine). It's a normal Linux process whose view of the system is constrained by kernel features:

- **Namespaces** — isolate *what a process can see*: PID (its own process tree), NET (own interfaces/ports), MNT (own filesystem mounts), UTS (hostname), IPC (Inter-Process Communication), USER (UID mapping), cgroup. The process thinks it's alone on the machine.
- **cgroups (control groups)** — limit and account *how much* a process can use: CPU, memory, I/O, PIDs. This enforces resource limits.
- **Union/overlay filesystem** — layered, copy-on-write image layers stacked into one view, with a thin writable layer on top per container.
- **Capabilities / seccomp / SELinux/AppArmor** — drop kernel privileges and restrict syscalls.

Crucial consequence: **containers share the host kernel.** A VM (Virtual Machine) has its own kernel + hypervisor (stronger isolation, heavier); a container is just isolated processes (lighter, faster start, weaker isolation boundary — a kernel exploit can cross it). Choose VMs when you need hard multi-tenant isolation, containers when you want density and speed.

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
- **ConfigMap / Secret** — inject config / sensitive data (Secrets are base64, *not* encrypted by default — enable encryption-at-rest + RBAC (Role-Based Access Control)).
- **Namespace** — logical partition for multi-tenancy/quotas.
- **HPA (Horizontal Pod Autoscaler)** — scales replica count on CPU/memory/custom metrics.

### Health & scheduling
- **Liveness probe** — restart the container if it's wedged.
- **Readiness probe** — remove the Pod from Service endpoints until it can serve (don't send traffic before warm-up).
- **Startup probe** — for slow-starting apps, before liveness kicks in.
- **Requests vs limits** — *requests* inform scheduling (guaranteed share) and *limits* cap usage. Memory over limit → **OOMKilled (Out of Memory Killed)**; CPU over limit → throttled. QoS (Quality of Service) classes (Guaranteed/Burstable/BestEffort) affect eviction order.

---

## 5. Common pitfalls & misconceptions

- "Containers are mini-VMs (Virtual Machines)." They share the host kernel; isolation is process-level, not hardware.
- Using `latest` tags — non-reproducible, breaks rollback. Pin digests.
- Running as root in the container (privilege escalation risk). Use non-root + drop capabilities.
- Storing secrets in image layers — they persist even if a later layer "removes" them.
- Treating Pods as pets — they're cattle; design stateless, store state externally.
- Putting unrelated processes in one container — one concern per container; use sidecars or separate Pods.
- No resource limits → noisy-neighbor and node OOM (Out of Memory); over-tight limits → constant OOMKills/throttling.
- Missing readiness probe → traffic hits a not-ready Pod during rollout → errors.
- Kubernetes Secrets are not encrypted by default (just base64); secure them explicitly.
- Bloated images from single-stage builds shipping compilers/build deps.

---

## 6. What interviewers probe

- "Container vs VM (Virtual Machine)" — namespaces + cgroups + shared kernel.
- How Docker layer caching works and how to order a Dockerfile.
- Liveness vs readiness probes (and the consequence of confusing them).
- Requests vs limits; what OOMKilled (Out of Memory Killed) and CPU throttling mean.
- How Kubernetes self-heals (reconciliation loop, desired vs actual).
- Service vs Deployment vs Pod; why you need a Service.
- Deployment (stateless) vs StatefulSet (stateful identity).
- Why not run a database casually in K8s without StatefulSet + persistent volumes.

---

## 7. Quick-reference summary

- **Container = isolated process:** namespaces (what it sees) + cgroups (how much it uses) + overlay FS, **sharing the host kernel**. Lighter than VMs (Virtual Machines), weaker isolation.
- **Images** are immutable layered FS; **order Dockerfiles** dep-first for cache; **multi-stage + non-root + pinned + small base**.
- **Kubernetes** = declarative desired-state reconciliation. Control plane (apiserver/etcd/scheduler/controllers) + nodes (kubelet/kube-proxy).
- **Pod** (smallest unit) → **ReplicaSet** → **Deployment** (rolling updates); **StatefulSet** for stateful; **Service** gives stable VIP (Virtual IP) / DNS; **Ingress** routes HTTP.
- **Probes:** liveness (restart), readiness (gate traffic), startup (slow boot).
- **Requests/limits** drive scheduling & caps; over-memory = OOMKilled (Out of Memory Killed), over-CPU = throttled.
- **Secrets are base64, not encrypted by default.**
