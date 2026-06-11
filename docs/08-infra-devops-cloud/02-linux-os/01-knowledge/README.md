# Linux & OS — Knowledge / Study Notes

> Topic: Shell, processes, signals, filesystem, permissions.

[← Topic overview](../README.md)

> **🛒 Where we are in building ShopFast** — Last topic we chose the [cloud primitives](../../04-cloud/01-knowledge/README.md) — VPC (Virtual Private Cloud), EKS (Elastic Kubernetes Service), RDS (Relational Database Service) — that ShopFast runs on. Now we go one layer deeper: when something breaks in production — a container is consuming 100% CPU, a disk is silently full, or an app refuses to shut down gracefully — you need to understand the Linux substrate to diagnose it. **Next:** instead of provisioning that cloud infrastructure by hand (ClickOps), we declare it as code in [IaC (Infrastructure as Code)](../../06-iac/01-knowledge/README.md).

---

## Teaching arc: debugging ShopFast in production

### What it is

**Linux** is the operating system that runs under every container, every cloud VM (Virtual Machine), and every Kubernetes node in ShopFast's stack. Understanding it means you can diagnose *any* production problem from first principles — without guessing.

Analogy: Linux is the engine room of a ship. As a passenger (app developer) you mostly stay on deck. But when the ship stops moving, the navigator (on-call engineer) goes below decks, reads the gauges (CPU, memory, I/O, network), listens for weird noises (signals, kernel logs), and traces the problem to its source. This topic is the map of the engine room.

### Why we use it

ShopFast's engineers need Linux knowledge when:

- A pod is `OOMKilled (Out of Memory Killed)` and you need to understand *which process* consumed memory and why.
- A service won't shut down gracefully — it's ignoring SIGTERM (Signal 15 — graceful shutdown request) and Kubernetes eventually SIGKILLs (Signal 9 — force kill) it, dropping in-flight requests.
- Disk space is full but `du` (disk usage) shows space free — the classic deleted-but-open-file trap.
- The box is "slow" and you need to determine whether it's CPU-bound, I/O-bound, or memory-thrashing before you can fix it.

### What it looks like

The 10-minute on-call triage sequence when "the ShopFast API is slow":

```bash
# Step 1: is the box overloaded?
uptime
# output: load average: 6.2, 5.8, 4.1
# load > # CPU cores = CPU saturation; investigate further

# Step 2: which process is eating resources?
top          # or htop for a nicer view
# columns: %CPU, %MEM, RES (resident memory), S (state), COMMAND

# Step 3: is it I/O wait?
iostat -x 1  # run every 1 second
# %wa (I/O wait) > 20% = disk is the bottleneck
# %util near 100% = disk is saturated

# Step 4: is memory OK?
free -h
# look at "available" — not "free" (Linux uses free RAM for disk cache, which is fine)
# swap "si"/"so" > 0 = memory thrashing — bad

# Step 5: what sockets is the app holding?
ss -tnp      # show TCP sockets with process names
# lots of CLOSE_WAIT = app not closing connections properly
# lots of TIME_WAIT = normal for high-throughput servers

# Step 6: is a specific process stuck?
strace -p <pid>  # show syscalls — see exactly what the process is waiting on
lsof -p <pid>    # show open files, sockets, and FD (File Descriptor) leaks
```

### ShopFast setup

ShopFast's Kubernetes pods run on Amazon Linux 2 (AL2) nodes. The ops team cares about these Linux settings:

**File descriptor limits** — ShopFast's Node.js server opens one FD per client connection. Default `ulimit -n` (max open files) is 1024; we set it to 65536 for prod:

```bash
# /etc/security/limits.conf on the node
shopfast soft nofile 65536
shopfast hard nofile 65536
# OR for the container, set in K8s pod spec:
# securityContext.sysctls: net.core.somaxconn=65535
```

**Graceful shutdown** — ShopFast's Node.js app must handle SIGTERM (Signal 15) to drain in-flight requests before the container stops:

```javascript
// src/index.ts — correct SIGTERM handler
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — draining connections');
  server.close(() => {           // stop accepting new requests
    db.pool.end();               // close DB connections
    redisClient.quit();          // close Redis connections
    process.exit(0);             // exit cleanly — Kubernetes marks pod Terminated
  });
  // timeout: if drain takes > 25 s, force exit (K8s grace period is 30 s)
  setTimeout(() => process.exit(1), 25000);
});
```

**Disk space** — ShopFast's containers log to stdout/stderr (12-factor). The node's `/var/log/containers/` grows unboundedly without log rotation. The team sets `logrotate` (log rotation tool) on nodes and configures Kubernetes to use a logging agent (Fluentd) that ships to CloudWatch:

```bash
# Diagnose a full disk
df -h          # show free space per filesystem
df -i          # show free INODES (many tiny files can exhaust inodes even with free space)
lsof | grep deleted  # find files deleted but still held open by a process
# If "deleted" files are holding space:
kill -HUP <pid>  # signal the process to reopen its log files (or restart it)
```

### Common failures & how to debug

| Failure | Symptom | Command to diagnose |
|---|---|---|
| `OOMKilled` (Out of Memory Killed) | Pod restarts, exit 137 | `dmesg | grep -i oom` — shows which process was killed and its memory usage |
| High load, low CPU% | Box feels slow; `top` shows low `%us` | `iostat -x` — high `%wa` = I/O bound; look for disk or NFS bottleneck |
| D-state process | Process won't die even with SIGKILL (Signal 9) | `ps aux | grep " D "` — D = uninterruptible sleep; fix the underlying I/O |
| Disk full but `du` looks fine | `df` shows 100%, `du /` shows space | `lsof +L1` — find deleted-but-open files; restart holder |
| "Too many open files" error | App crashes with `EMFILE` | `lsof -p <pid> | wc -l` — count FDs; `ulimit -n` — check limit; look for FD leak |
| Zombie processes | `ps` shows Z state processes | Parent not calling `wait()`; in containers, PID 1 must reap — use `tini` init |
| App doesn't respond to SIGTERM | Kubernetes eventually SIGKILL (Signal 9) | Check if app uses shell wrapper (`CMD sh -c ...`) — shell eats signals; use exec form |
| Timezone mismatch | Timestamps wrong in logs | `timedatectl` on node; set `TZ=UTC` in container env |

The most important thing to understand for production: **load average is not CPU percentage**.

```bash
uptime
# 14:32:01 up 5 days | load average: 8.5, 7.2, 6.1
#                                     ^1min ^5min ^15min
```

Load average counts **runnable + uninterruptible (D-state) tasks**. On a 4-core box:
- Load 2.0 = 50% utilized (comfortable)
- Load 4.0 = 100% utilized (all cores busy)
- Load 8.0 = saturated (queue building up — latency spikes)
- High load with low `%us` in `top` = the bottleneck is I/O, not CPU.

### Types & differences

| Signal | Number | Catchable? | Use |
|---|---|---|---|
| `SIGTERM` | 15 | Yes | Graceful shutdown — what Kubernetes sends first |
| `SIGKILL` | 9 | **No** | Force kill — what Kubernetes sends after grace period |
| `SIGINT` | 2 | Yes | Ctrl-C in terminal |
| `SIGHUP` | 1 | Yes | Terminal hangup; commonly used to trigger config reload |
| `SIGSTOP` | 19 | **No** | Pause process (Ctrl-Z = SIGTSTP, which IS catchable) |
| `SIGSEGV` | 11 | Yes (usually terminates) | Segmentation fault — invalid memory access |
| `SIGPIPE` | 13 | Yes | Wrote to closed pipe/socket |

| Process state | Code | Meaning |
|---|---|---|
| Running/Runnable | `R` | On CPU or waiting for CPU |
| Interruptible sleep | `S` | Waiting for I/O; can be interrupted by a signal |
| **Uninterruptible sleep** | **`D`** | **Waiting in kernel I/O; CANNOT be killed** — fix the I/O |
| Zombie | `Z` | Exited but parent hasn't called `wait()` |
| Stopped | `T` | Suspended (SIGSTOP/SIGTSTP) |

---

Linux is the substrate every backend runs on. Senior signal: you can reason about processes/signals, diagnose a hung or slow box from first principles, understand the filesystem and permission model, and wield the shell to investigate production without panicking.

---

## 1. Processes & the process model

- A **process** is a running program with its own virtual address space, file descriptors, and PID (Process ID). **Threads** share the address space within a process.
- **fork + exec:** new processes are created by `fork()` (clone the parent) then `exec()` (replace the image). The shell does this for every command.
- **PID 1 (init)** — the first process; in containers your app is often PID 1 (must handle signals + reap children, or use a tiny init like `tini`).
- **Parent/child & zombies:** when a child exits, it becomes a **zombie** until the parent `wait()`s to read its exit status. A parent that never reaps leaks zombies. If a parent dies first, children are **re-parented to init**, which reaps them ("orphans").
- **Process states:** R (running/runnable), S (interruptible sleep, e.g., waiting on I/O), **D (uninterruptible sleep — usually stuck in disk/NFS (Network File System) I/O; can't be killed)**, Z (zombie), T (stopped). A pile of **D-state** processes signals an I/O problem.
- **Scheduling & priority:** `nice`/`renice` (-20 high … 19 low) hint the scheduler. `cgroups (control groups)` enforce hard CPU/memory limits (the basis of containers).
- **The OOM (Out of Memory) killer:** when memory is exhausted, the kernel kills a process by an `oom_score`. Seeing "Killed" with no app error in logs → check `dmesg`/journal for OOM.

---

## 2. Signals

Signals are asynchronous notifications to a process. Know the big ones:

| Signal | Number | Default | Catchable? | Use |
|---|---|---|---|---|
| `SIGTERM` | 15 | terminate | yes | **Graceful shutdown** (`kill` default) |
| `SIGKILL` | 9 | terminate | **no** | Force kill — can't be trapped/ignored |
| `SIGINT` | 2 | terminate | yes | Ctrl-C |
| `SIGHUP` | 1 | terminate | yes | Terminal hangup; often "reload config" |
| `SIGSTOP`/`SIGCONT` | 19/18 | stop/resume | no/—| Pause/resume (Ctrl-Z = SIGTSTP) |
| `SIGCHLD` | 17 | ignore | yes | Child changed state |
| `SIGSEGV` | 11 | core dump | yes | Invalid memory access |
| `SIGPIPE` | 13 | terminate | yes | Wrote to a closed pipe/socket |

Key insight: **graceful shutdown = catch SIGTERM (Signal 15), finish in-flight work, close connections, then exit.** Orchestrators send SIGTERM, wait a grace period, then SIGKILL (Signal 9). `SIGKILL` and `SIGSTOP` cannot be caught — that's why a `D`-state process won't even die on SIGKILL (it's blocked in the kernel).

---

## 3. Filesystem & file descriptors

- **Everything is a file** — devices, sockets, pipes appear in the filesystem. Standard FDs (File Descriptors): 0 stdin, 1 stdout, 2 stderr.
- **FHS (Filesystem Hierarchy Standard) layout:** `/etc` (config), `/var` (logs/state, `/var/log`), `/tmp` (ephemeral), `/proc` & `/sys` (virtual kernel interfaces — `/proc/<pid>/` exposes per-process info), `/dev`, `/home`, `/usr`.
- **Inodes vs names:** a file's data + metadata live in an **inode**; a directory entry (hard link) maps a name to an inode. A file is deleted only when its **link count AND open-FD count both hit zero**. Hence the classic gotcha: **deleting a file that a process still has open does NOT free disk space** — `df` stays full, `du` looks fine — until the process closes the FD or restarts. Find it with `lsof | grep deleted`.
- **Hard vs symbolic links:** hard link = another name for the same inode (same filesystem). Symlink = a pointer to a path (can dangle, cross filesystems).
- **Mounts & disk:** `df -h` (free space per filesystem), `du -sh *` (usage per path), inode exhaustion (`df -i`) — many tiny files can exhaust inodes even with free space.

---

## 4. Permissions

- **Mode bits:** `rwx` for **user / group / other**. Octal: r=4, w=2, x=1 → `chmod 755` = `rwxr-xr-x`. On a **directory**, `x` means "can traverse/enter"; `r` means "can list".
- `chown user:group file`, `chmod`, `umask` (default-permission mask for new files).
- **Special bits:** **setuid** (run as file owner — e.g., `passwd`), **setgid** (run as group / inherit group on dirs), **sticky bit** on `/tmp` (only owner can delete their files in a world-writable dir).
- **Least privilege:** run services as non-root dedicated users; use `sudo` with scoped rules; capabilities (`CAP_NET_BIND_SERVICE` to bind <1024 without full root). SELinux (Security-Enhanced Linux) / AppArmor add MAC (Mandatory Access Control) on top of DAC (Discretionary Access Control) permissions.

---

## 5. The shell & text tooling

- **Pipes & redirection:** `|` connects stdout→stdin; `>` overwrite, `>>` append, `2>` stderr, `2>&1` merge stderr into stdout, `<` stdin, `/dev/null` discard.
- **Job control:** `&` background, `jobs`, `fg`/`bg`, `Ctrl-Z` suspend; `nohup`/`disown`/`setsid` to survive logout; **`tmux`/`screen`** for durable sessions.
- **The investigation toolkit (text):** `grep`/`rg` (search), `awk` (column/field processing), `sed` (stream edit), `cut`, `sort`, `uniq -c`, `wc -l`, `xargs`, `find`, `tail -f` (follow logs), `jq` (JSON). A one-liner like `grep ERROR app.log | awk '{print $5}' | sort | uniq -c | sort -rn` ranks the most common errors.
- **Exit codes:** 0 = success; non-zero = failure. `$?` holds the last code. `&&`/`||` chain on success/failure. `set -euo pipefail` for safe scripts.

---

## 6. Diagnosing a sick box (mental model)

Use the **USE method** (Utilization, Saturation, Errors) across resources. Quick tour:

- **CPU:** `top`/`htop` (per-process CPU), `uptime` **load average** (run-queue length; load > #cores = saturation), `mpstat`. High `%us` = app CPU; high `%sy` = kernel/syscalls; high `%wa` = **I/O wait** (disk bottleneck); high `%si`/softirq = network.
- **Memory:** `free -h` (watch *available*, not just free — Linux uses free RAM as cache), `vmstat` (`si`/`so` swap activity = thrashing). OOM (Out of Memory) in `dmesg`.
- **Disk:** `iostat -x` (`%util`, `await`), `df -h`/`df -i`, `du`, `lsof +L1` (deleted-but-open files).
- **Network:** `ss -tnp` / `netstat` (sockets, listening ports, connection states like TIME_WAIT/CLOSE_WAIT), `ping`/`traceroute`, `dig` (DNS (Domain Name System)), `curl -v`, `tcpdump` (packet capture).
- **Per-process deep dive:** `strace -p <pid>` (syscalls — see what a hung process is blocked on), `lsof -p <pid>` (open files/sockets/FD leaks), `/proc/<pid>/`, `ulimit -n` (FD (File Descriptor) limit — "too many open files" = leak or low limit), `pmap`.
- **Logs:** `journalctl -u svc -f`, `/var/log/`, `dmesg` (kernel/OOM/hardware).

**Worked pattern:** "App is slow" → `top` shows low CPU but high load → `iostat` shows `%util` 100% → `iotop`/`lsof` finds a runaway log write or a full disk → fix the disk, not the app.

---

## Common pitfalls & misconceptions

- "`df` is full but `du` shows space free" → a deleted-but-still-open file; restart the holder or `lsof | grep deleted`.
- Sending SIGKILL (Signal 9) to a `D`-state process and expecting it to die — it's blocked in the kernel; fix the I/O.
- Thinking "high memory used" is bad — Linux uses free RAM for page cache; look at **available** and swap activity.
- Confusing **load average** with CPU% — load counts runnable *and* uninterruptible (I/O-waiting) tasks.
- Running services as root "to make it work" — privilege creep.
- `chmod 777` as a fix — almost always wrong; opens a security hole.
- Not handling SIGTERM (Signal 15) → orchestrator SIGKILLs (Signal 9) mid-request → dropped connections.
- "Too many open files" treated as mysterious — it's an FD (File Descriptor) leak or a low `ulimit -n`.
- Forgetting that a child needs reaping → zombie buildup (PID (Process ID) 1-in-container problem).

---

## What interviewers probe

- "App slow / box hung — how do you diagnose?" (the USE tour above, with specific tools).
- SIGTERM (Signal 15) vs SIGKILL (Signal 9) and graceful shutdown.
- Why a deleted file doesn't free space (inodes + open FDs).
- Process states, especially D-state and zombies.
- Load average meaning vs CPU utilization.
- Permission bits and least-privilege service setup.
- A shell one-liner to extract/aggregate from logs.

---

## Quick-reference summary

- **Process:** fork+exec, PID (Process ID) 1, zombies (need `wait`), states R/S/**D**/Z/T; OOM (Out of Memory) killer picks a victim.
- **Signals:** SIGTERM (15) = graceful (catchable), **SIGKILL (9) / SIGSTOP uncatchable**; trap SIGTERM for clean shutdown.
- **Filesystem:** everything's a file; **inode + name (hard link)**; deleted-but-open file keeps disk used; `/proc` exposes process internals.
- **Permissions:** `rwx` user/group/other (octal), dir `x` = traverse; least privilege, non-root services.
- **Diagnose with USE (Utilization, Saturation, Errors):** `top`/load, `free`/`vmstat`, `iostat`/`df -i`/`lsof`, `ss`/`tcpdump`, `strace`, `journalctl`/`dmesg`.
- **Shell:** pipes/redirection, exit codes, `grep|awk|sort|uniq -c` for log forensics, `tmux` for durable sessions.
