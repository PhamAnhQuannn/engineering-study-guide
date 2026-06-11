# Linux & OS — Practice Questions

> Topic: Shell, processes, signals, filesystem, permissions.

[← Topic overview](../README.md)

---

### Q1. What's the difference between SIGTERM and SIGKILL?

**Answer:** **SIGTERM (15)** is the polite "please terminate" — it's the default of `kill`, and a process can **catch** it to run cleanup (finish in-flight requests, flush buffers, close connections, deregister) before exiting gracefully. **SIGKILL (9)** is the forced kill — it **cannot be caught, blocked, or ignored**; the kernel terminates the process immediately with no chance to clean up. Orchestrators send SIGTERM, wait a grace period, then SIGKILL if the process is still alive. Always handle SIGTERM for graceful shutdown so deploys don't drop user requests.

---

### Q2. `df` says the disk is full but `du -sh` of everything adds up to far less. What's going on?

**Answer:** A process is holding an **open file descriptor to a file that has been deleted**. On Linux a file's blocks are freed only when both its link count (directory names) and its open-FD count reach zero. If you `rm` a large log/temp file while a process still has it open, the name is gone (so `du` doesn't count it) but the blocks stay allocated (so `df` stays full) until that process closes the FD or restarts. Find it with `lsof | grep deleted` (or `lsof +L1`), then restart/signal the holder.

---

### Q3. Explain Linux file permissions and what `chmod 755` means, to a junior.

**Answer:** Each file has permission bits for three classes — **user (owner), group, other** — each with read (4), write (2), execute (1). You sum them per class: `7 = 4+2+1 = rwx`, `5 = 4+0+1 = r-x`. So `chmod 755` = `rwxr-xr-x`: owner can read/write/execute, group and others can read/execute. On a **directory**, `x` means "may enter/traverse it" and `r` means "may list its contents" — a common source of confusion. Avoid `chmod 777` (world-writable) — it's almost always a security hole.

---

### Q4. What is a zombie process and why does it happen?

**Answer:** When a child process exits, the kernel keeps a minimal entry holding its exit status until the **parent calls `wait()`** to collect it. During that window the child is a **zombie** (state Z) — already dead, just not reaped. Zombies pile up when a parent doesn't reap its children. If the parent dies first, the children are re-parented to init (PID 1), which reaps them. This matters in containers: if your app is PID 1 and spawns children, it must reap them (or run a tiny init like `tini`), or zombies accumulate.

---

### Q5. A process is in "D" state and won't die even with `kill -9`. Why?

**Answer:** **D = uninterruptible sleep**, almost always blocked inside the kernel waiting on I/O (disk, NFS, a stuck device). SIGKILL can't interrupt it because the process isn't in a state where it can handle *any* signal — it's mid-syscall in the kernel. You can't kill it until the I/O completes or errors out. The real fix is the underlying I/O problem (failing disk, hung NFS mount, overloaded storage), not the signal.

---

### Q6. How do you investigate "the server is slow"? Walk through your first steps.

**Answer:** Work resource by resource (USE: utilization, saturation, errors):
1. `top`/`htop` and `uptime` — is CPU pegged? Is **load average** above the core count? Which process?
2. Distinguish `%us` (app CPU) vs `%sy` (kernel) vs **`%wa` (I/O wait)** — high wait points at disk.
3. `free -h` / `vmstat` — memory pressure or swapping (`si`/`so`)?
4. `iostat -x` — disk `%util`/`await`; `df -h`/`df -i` — full disk or inodes.
5. `ss -tnp` — connection pile-ups (CLOSE_WAIT/TIME_WAIT), too many sockets.
6. Drill into the culprit: `strace -p <pid>` (what syscall is it stuck on), `lsof -p <pid>` (FD leaks), `journalctl`/`dmesg` (OOM, errors).

The point is to let data, not guesses, lead you to the bottleneck.

---

### Q7 (MCQ). Which signal can a process NOT catch or ignore?

A. SIGTERM  B. SIGHUP  C. SIGKILL  D. SIGINT

**Answer: C.** SIGKILL (and SIGSTOP) are handled directly by the kernel and cannot be trapped, blocked, or ignored.

---

### Q8 (MCQ). Linux shows most RAM "used" with little "free". Is this a problem?

A. Yes, you're out of memory  
B. No — Linux uses free RAM as page cache; check *available* and swap activity instead  
C. Yes, restart immediately  
D. It means a memory leak

**Answer: B.** Linux deliberately uses otherwise-idle RAM for disk cache (reclaimable on demand). Look at the **available** column and swap in/out (`si`/`so` in `vmstat`) to judge real pressure.

---

### Q9 (MCQ). What does the load average represent?

A. CPU utilization percentage  
B. Number of runnable + uninterruptible (I/O-waiting) tasks, averaged over time  
C. Memory pressure  
D. Number of logged-in users

**Answer: B.** Load average counts processes that are running, runnable, *and* in uninterruptible I/O wait — which is why a box can show 100% load with low CPU% (it's I/O-bound). Compare load against the core count.

---

### Q10 (MCQ). Your app logs "too many open files". The most likely cause is:

A. The disk is full  
B. A file-descriptor leak and/or a low `ulimit -n`  
C. SIGPIPE  
D. A zombie process

**Answer: B.** The process hit its open-FD limit — either it's leaking descriptors (not closing sockets/files) or `ulimit -n` is too low. Diagnose with `lsof -p <pid>` and raise the limit only after confirming it's not a leak.

---

### Q11. Write a shell one-liner to find the 10 most frequent IPs in an access log, and explain it.

**Answer:**
```bash
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10
```
`awk '{print $1}'` extracts the first field (client IP) from each line; `sort` groups identical IPs together so `uniq -c` can count consecutive duplicates; `sort -rn` orders by that count descending (numeric, reverse); `head -10` keeps the top 10. This pattern — *extract → sort → uniq -c → sort -rn* — is the workhorse for log forensics (top errors, top endpoints, top users).

---

### Q12. What is the difference between a hard link and a symbolic link?

**Answer:** A **hard link** is an additional directory entry pointing at the *same inode* — both names are equal, the data persists until all hard links are removed, and they must live on the same filesystem (you can't hard-link a directory). A **symbolic (soft) link** is a small special file containing a *path* to another file — it can cross filesystems, can point at directories, and **dangles** (becomes broken) if the target is moved or deleted. Hard links share identity; symlinks are pointers to a name.
