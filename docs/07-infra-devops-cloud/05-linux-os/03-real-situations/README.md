# Linux & OS — Real-World Situations

> Topic: Shell, processes, signals, filesystem, permissions.

[← Topic overview](../README.md)

On-the-job scenarios. Each: **approach → diagnose with data → communicate → root-cause fix → prevention.**

---

### Situation 1 — Production server's disk is 100% full and the app is throwing write errors

**Approach:** Free space fast to restore service, then find the real consumer.

**Diagnose:** `df -h` confirms which filesystem is full; `df -i` rules in/out inode exhaustion. `du -xh / | sort -rh | head` (or `ncdu`) finds the big directories — usually runaway logs in `/var/log` or a temp/upload dir. If `du` totals far less than `df` reports, run `lsof +L1` / `lsof | grep deleted` — a process is holding a deleted huge file open.

**Communicate:** Declare an incident; note you're freeing space and chasing root cause.

**Root-cause fix:** Truncate/rotate the offending log (`truncate -s 0`, never just `rm` a file a process holds open — that won't free space). If it's a deleted-but-open file, restart the holding process. Then fix the source: a verbose log level left on, missing rotation, a runaway loop writing data.

**Prevention:** Configure **logrotate** with size/age caps, ship logs off-box, set disk-usage alerts at 80%, put `/var/log` on its own volume so a log flood can't take down the root filesystem, and enforce log-level config.

---

### Situation 2 — A service was OOMKilled and nobody knows why; the app logs show no error

**Approach:** A silent "Killed" with no app-level stack trace points at the kernel OOM killer or the orchestrator.

**Diagnose:** `dmesg -T | grep -i oom` / `journalctl -k` shows the OOM event, the victim PID, and its memory at kill time. In Kubernetes, the Pod status will read `OOMKilled`. Check `free -h`/`vmstat` history and the process's RSS growth trend (memory leak vs legitimate spike vs limit too low).

**Communicate:** Report whether it was a leak (needs a code fix) or under-provisioning (needs a limit bump), with the dmesg evidence.

**Root-cause fix:** If a leak — fix the code (unbounded cache, unclosed buffers) and add a memory profile to CI. If the limit was simply too low for legitimate load — raise the memory request/limit. Right-size based on observed working set.

**Prevention:** Memory limits + alerts on RSS approaching limit; load tests that watch memory; bounded caches; restart policies so a single OOM doesn't cascade.

---

### Situation 3 — Deploys are dropping in-flight user requests (users see errors during rollouts)

**Approach:** The app isn't shutting down gracefully — it's being killed mid-request.

**Diagnose:** Check whether the app handles **SIGTERM**. Orchestrators send SIGTERM, wait a grace period, then SIGKILL. If the app ignores SIGTERM (or runs behind a shell that swallows the signal so it never reaches PID 1), it gets force-killed with requests still open. Reproduce by sending SIGTERM locally and watching behavior.

**Communicate:** Tie the user-facing errors to the deploy window; explain the graceful-shutdown gap.

**Root-cause fix:** Implement a SIGTERM handler: stop accepting new connections, drain/finish in-flight requests, deregister from the load balancer/readiness, close DB/connections, then exit before the grace period ends. Use `exec` form (not a shell wrapper) so signals reach the process as PID 1; add an init (`tini`) if needed.

**Prevention:** Standardize graceful shutdown + readiness gating across services; set the termination grace period above the longest expected request; add a connection-draining step (preStop hook) in the deploy.

---

### Situation 4 — "Too many open files" errors under load

**Approach:** The process hit its file-descriptor ceiling — either a leak or a too-low limit.

**Diagnose:** `lsof -p <pid> | wc -l` shows current FD count; `cat /proc/<pid>/limits` and `ulimit -n` show the cap. Inspect *what* the FDs are: many sockets in CLOSE_WAIT means the app isn't closing connections (a leak); steadily climbing FDs over time confirms a leak; a flat-but-high count near a low limit means under-provisioned.

**Communicate:** State whether it's a leak (code fix) or limit (config), with the FD breakdown.

**Root-cause fix:** If a leak — fix the code to close sockets/files/handles (use connection pools, `with`/`defer`/`try-with-resources`). If the limit is genuinely too low for legitimate concurrency — raise `nofile` (systemd `LimitNOFILE`, container ulimits) after confirming it's not a leak.

**Prevention:** Sane `nofile` limits set in the service manifest; FD-count monitoring/alerts; code review for resource cleanup; pooling.

---

### Situation 5 — One process is pegging CPU and the box is sluggish for everything else

**Approach:** Identify the hog, decide whether to throttle or kill, then find why.

**Diagnose:** `top`/`htop` ranks by CPU; note whether it's `%us` (app busy-loop) or `%sy` (syscall storm). `strace -p <pid>` reveals a tight syscall loop; a thread dump / profiler (`perf top`, language profiler) reveals a hot code path or a busy-wait.

**Communicate:** Note impact on co-located workloads; propose mitigation.

**Root-cause fix:** Short-term, `renice` it lower or move it to a constrained cgroup to protect neighbors; if it's stuck in a runaway loop, restart it. Long-term, fix the hot path (busy-wait → proper blocking, missing backoff, an unbounded retry, an `O(n^2)` on a big input).

**Prevention:** Run workloads under cgroup CPU limits so one process can't starve the box (isolation), add CPU alerts, and load-test the hot path. Avoid co-locating noisy and latency-sensitive workloads.

---

### Situation 6 — A cron job / scheduled task silently stopped running

**Approach:** Crons fail quietly because their output goes nowhere by default.

**Diagnose:** `grep CRON /var/log/syslog` (or `journalctl -u cron`) confirms whether it fired at all. Common causes: the job ran but errored (no output captured), a **PATH/environment difference** (cron has a minimal env, so commands that work in your shell aren't found), wrong user/permissions, or the previous run is still hung and overlapping. Run the exact command as the cron user with cron's environment to reproduce.

**Communicate:** Report whether it's not firing vs firing-and-failing — very different fixes.

**Root-cause fix:** Use absolute paths and set required env in the crontab; redirect output to a log (`>> /var/log/job.log 2>&1`) so failures are visible; add a lock (`flock`) to prevent overlapping runs; ensure the cron user has needed permissions.

**Prevention:** Capture and alert on cron output/exit codes; add dead-man's-switch monitoring (alert if the job *doesn't* check in); consider a real scheduler (systemd timers / orchestrated jobs) with built-in logging and retries.

---

### Situation 7 — Intermittent network timeouts to a downstream service; app blames the network

**Approach:** Confirm whether it's actually the network, DNS, connection limits, or the downstream.

**Diagnose:** `ss -tnp` to see connection states — a flood of `TIME_WAIT`/`CLOSE_WAIT` hints at connection churn or unclosed sockets; `dig`/`nslookup` to check DNS resolution and TTLs; `curl -v`/`traceroute` to the dependency; `tcpdump` to see if SYNs go out and whether replies come back (retransmits = packet loss). Check whether timeouts correlate with the downstream's own latency/errors.

**Communicate:** Bring data (packet captures, socket states) rather than "the network is flaky"; loop in the downstream owners if it's them.

**Root-cause fix:** Depending on findings: enable connection pooling/keep-alive (stop churning connections), fix unclosed sockets, tune DNS caching/TTL, add sensible timeouts + retries with backoff and a circuit breaker so a slow dependency doesn't pile up, or escalate to the downstream if it's the actual culprit.

**Prevention:** Connection pools with limits, explicit client timeouts (never infinite), circuit breakers, and observability on dependency latency/error rates so "the network" claims can be verified with data.
