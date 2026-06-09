# Linux & OS — Knowledge / Study Notes

> Topic: Shell, processes, signals, filesystem, permissions.

[← Topic overview](../README.md)

Linux is the substrate every backend runs on. Senior signal: you can reason about processes/signals, diagnose a hung or slow box from first principles, understand the filesystem and permission model, and wield the shell to investigate production without panicking.

---

## 1. Processes & the process model

- A **process** is a running program with its own virtual address space, file descriptors, and PID. **Threads** share the address space within a process.
- **fork + exec:** new processes are created by `fork()` (clone the parent) then `exec()` (replace the image). The shell does this for every command.
- **PID 1 (init)** — the first process; in containers your app is often PID 1 (must handle signals + reap children, or use a tiny init like `tini`).
- **Parent/child & zombies:** when a child exits, it becomes a **zombie** until the parent `wait()`s to read its exit status. A parent that never reaps leaks zombies. If a parent dies first, children are **re-parented to init**, which reaps them ("orphans").
- **Process states:** R (running/runnable), S (interruptible sleep, e.g., waiting on I/O), **D (uninterruptible sleep — usually stuck in disk/NFS I/O; can't be killed)**, Z (zombie), T (stopped). A pile of **D-state** processes signals an I/O problem.
- **Scheduling & priority:** `nice`/`renice` (-20 high … 19 low) hint the scheduler. `cgroups` enforce hard CPU/memory limits (the basis of containers).
- **The OOM killer:** when memory is exhausted, the kernel kills a process by an `oom_score`. Seeing "Killed" with no app error in logs → check `dmesg`/journal for OOM.

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

Key insight: **graceful shutdown = catch SIGTERM, finish in-flight work, close connections, then exit.** Orchestrators send SIGTERM, wait a grace period, then SIGKILL. `SIGKILL` and `SIGSTOP` cannot be caught — that's why a `D`-state process won't even die on SIGKILL (it's blocked in the kernel).

---

## 3. Filesystem & file descriptors

- **Everything is a file** — devices, sockets, pipes appear in the filesystem. Standard FDs: 0 stdin, 1 stdout, 2 stderr.
- **FHS layout:** `/etc` (config), `/var` (logs/state, `/var/log`), `/tmp` (ephemeral), `/proc` & `/sys` (virtual kernel interfaces — `/proc/<pid>/` exposes per-process info), `/dev`, `/home`, `/usr`.
- **Inodes vs names:** a file's data + metadata live in an **inode**; a directory entry (hard link) maps a name to an inode. A file is deleted only when its **link count AND open-FD count both hit zero**. Hence the classic gotcha: **deleting a file that a process still has open does NOT free disk space** — `df` stays full, `du` looks fine — until the process closes the FD or restarts. Find it with `lsof | grep deleted`.
- **Hard vs symbolic links:** hard link = another name for the same inode (same filesystem). Symlink = a pointer to a path (can dangle, cross filesystems).
- **Mounts & disk:** `df -h` (free space per filesystem), `du -sh *` (usage per path), inode exhaustion (`df -i`) — many tiny files can exhaust inodes even with free space.

---

## 4. Permissions

- **Mode bits:** `rwx` for **user / group / other**. Octal: r=4, w=2, x=1 → `chmod 755` = `rwxr-xr-x`. On a **directory**, `x` means "can traverse/enter"; `r` means "can list".
- `chown user:group file`, `chmod`, `umask` (default-permission mask for new files).
- **Special bits:** **setuid** (run as file owner — e.g., `passwd`), **setgid** (run as group / inherit group on dirs), **sticky bit** on `/tmp` (only owner can delete their files in a world-writable dir).
- **Least privilege:** run services as non-root dedicated users; use `sudo` with scoped rules; capabilities (`CAP_NET_BIND_SERVICE` to bind <1024 without full root). SELinux/AppArmor add mandatory access control on top of discretionary permissions.

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
- **Memory:** `free -h` (watch *available*, not just free — Linux uses free RAM as cache), `vmstat` (`si`/`so` swap activity = thrashing). OOM in `dmesg`.
- **Disk:** `iostat -x` (`%util`, `await`), `df -h`/`df -i`, `du`, `lsof +L1` (deleted-but-open files).
- **Network:** `ss -tnp` / `netstat` (sockets, listening ports, connection states like TIME_WAIT/CLOSE_WAIT), `ping`/`traceroute`, `dig` (DNS), `curl -v`, `tcpdump` (packet capture).
- **Per-process deep dive:** `strace -p <pid>` (syscalls — see what a hung process is blocked on), `lsof -p <pid>` (open files/sockets/FD leaks), `/proc/<pid>/`, `ulimit -n` (FD limit — "too many open files" = leak or low limit), `pmap`.
- **Logs:** `journalctl -u svc -f`, `/var/log/`, `dmesg` (kernel/OOM/hardware).

**Worked pattern:** "App is slow" → `top` shows low CPU but high load → `iostat` shows `%util` 100% → `iotop`/`lsof` finds a runaway log write or a full disk → fix the disk, not the app.

---

## Common pitfalls & misconceptions

- "`df` is full but `du` shows space free" → a deleted-but-still-open file; restart the holder or `lsof | grep deleted`.
- Sending SIGKILL to a `D`-state process and expecting it to die — it's blocked in the kernel; fix the I/O.
- Thinking "high memory used" is bad — Linux uses free RAM for page cache; look at **available** and swap activity.
- Confusing **load average** with CPU% — load counts runnable *and* uninterruptible (I/O-waiting) tasks.
- Running services as root "to make it work" — privilege creep.
- `chmod 777` as a fix — almost always wrong; opens a security hole.
- Not handling SIGTERM → orchestrator SIGKILLs mid-request → dropped connections.
- "Too many open files" treated as mysterious — it's an FD leak or a low `ulimit -n`.
- Forgetting that a child needs reaping → zombie buildup (PID-1-in-container problem).

---

## What interviewers probe

- "App slow / box hung — how do you diagnose?" (the USE tour above, with specific tools).
- SIGTERM vs SIGKILL and graceful shutdown.
- Why a deleted file doesn't free space (inodes + open FDs).
- Process states, especially D-state and zombies.
- Load average meaning vs CPU utilization.
- Permission bits and least-privilege service setup.
- A shell one-liner to extract/aggregate from logs.

---

## Quick-reference summary

- **Process:** fork+exec, PID 1, zombies (need `wait`), states R/S/**D**/Z/T; OOM killer picks a victim.
- **Signals:** SIGTERM = graceful (catchable), **SIGKILL/SIGSTOP uncatchable**; trap SIGTERM for clean shutdown.
- **Filesystem:** everything's a file; **inode + name (hard link)**; deleted-but-open file keeps disk used; `/proc` exposes process internals.
- **Permissions:** `rwx` user/group/other (octal), dir `x` = traverse; least privilege, non-root services.
- **Diagnose with USE:** `top`/load, `free`/`vmstat`, `iostat`/`df -i`/`lsof`, `ss`/`tcpdump`, `strace`, `journalctl`/`dmesg`.
- **Shell:** pipes/redirection, exit codes, `grep|awk|sort|uniq -c` for log forensics, `tmux` for durable sessions.
