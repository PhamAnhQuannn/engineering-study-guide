# Concurrency Basics — Real-World Situations

[← Topic overview](../README.md)

> Topic: Threads, locks, race conditions, deadlock, async.

On-the-job concurrency scenarios. Each follows: **model approach → diagnose with data → communicate → root-cause fix → prevention.** These are the kinds of incidents a senior engineer is expected to lead.

---

## Situation 1 — Intermittent wrong counts in an analytics aggregator

**Symptom:** A service tallying events under-reports totals by a few percent, non-deterministically; unit tests pass.

- **Approach:** Suspect a race on shared mutable state since the error is timing-dependent and non-reproducible single-threaded.
- **Diagnose with data:** Run the test suite under a **race detector** (`go test -race`, Java with stress/jcstress, Python with high thread count + assertions). Add metrics comparing input event count vs aggregated count. The detector flags an unsynchronized `map`/counter write.
- **Communicate:** "Confirmed a data race on the shared counter — totals are correct only when threads happen not to interleave. It's a correctness bug, not a transient." Give an ETA and note no data is lost upstream.
- **Root-cause fix:** Replace the raw `count += 1` / shared map with an atomic counter or a concurrent map; or use per-shard counters merged at flush time to avoid contention.
- **Prevention:** Make `-race` part of CI; ban shared mutable maps without synchronization in code review; prefer immutable/sharded aggregation patterns.

---

## Situation 2 — Production deadlock under peak load

**Symptom:** Request throughput drops to zero during peak; threads pile up; no crash, no errors — the service just hangs.

- **Approach:** A hang with healthy CPU-idle and no progress screams **deadlock** (or a stuck external dependency).
- **Diagnose with data:** Capture a **thread dump** (`jstack`, `kill -3`, `pprof goroutine`). Look for threads in `BLOCKED`/`WAITING` forming a cycle — Thread A holds Lock 1 waiting for Lock 2, Thread B holds Lock 2 waiting for Lock 1.
- **Communicate:** Declare an incident, mitigate first (rolling restart to clear the hung state), then explain the lock-ordering cycle found in the dump.
- **Root-cause fix:** Impose a **global lock acquisition order** (e.g., by resource id), or restructure so the two locks are never held simultaneously, or use `tryLock` with timeout + retry.
- **Prevention:** Lock-ordering convention documented and lint-enforced; deadlock detectors / lock-order verification in tests; alert on thread-pool saturation and rising queue depth before it fully locks up.

---

## Situation 3 — Event loop stalls cause latency spikes

**Symptom:** A Node.js/asyncio service shows periodic p99 latency spikes across *all* endpoints simultaneously, unrelated to traffic.

- **Approach:** Simultaneous, cross-endpoint spikes point to **the event loop being blocked** — one synchronous operation freezes everything.
- **Diagnose with data:** Measure **event-loop lag** (Node `perf_hooks` / `--prof`, async profiler). Correlate spikes with a code path doing synchronous JSON parsing of large payloads, sync crypto, or a blocking DB driver call.
- **Communicate:** "A CPU-heavy synchronous call is monopolizing the single event-loop thread, so every concurrent request waits behind it. Not a capacity problem."
- **Root-cause fix:** Move the heavy/synchronous work off the loop — worker threads / a thread pool for CPU work, streaming/chunked parsing, or an async non-blocking driver. Never call blocking APIs on the loop.
- **Prevention:** Event-loop-lag SLO with alerting; lint rules banning known sync calls (`fs.readFileSync`, blocking drivers) on hot paths; load tests that include large-payload cases.

---

## Situation 4 — Connection pool exhaustion under load

**Symptom:** Requests start timing out with "could not acquire connection"; DB itself is healthy and underutilized.

- **Approach:** The bottleneck is the **bounded pool** (a semaphore over connections), not the DB. Likely connections leak or are held too long.
- **Diagnose with data:** Graph pool utilization (active vs idle vs waiters). A climbing "waiters" line with maxed-out active connections confirms exhaustion. Trace shows connections held across slow external calls or not returned on error paths.
- **Communicate:** "We're saturating a 20-connection pool because connections are held during a slow downstream call and one error path forgets to release. The DB has headroom; the pool is the constraint."
- **Root-cause fix:** Ensure connections are released in `finally`/`defer`; shorten the critical section (don't hold a connection across unrelated I/O); right-size the pool to the DB's real concurrency budget; add acquisition timeouts so callers fail fast instead of piling up.
- **Prevention:** Pool metrics + alerts on waiter count; leak detection (warn on connections held beyond a threshold); load test the saturation point; circuit breaker on the slow downstream.

---

## Situation 5 — Lost updates from concurrent edits (logical race above the DB)

**Symptom:** Two users edit the same record near-simultaneously; one user's changes silently vanish.

- **Approach:** This is a **read-modify-write race** at the application level — last writer wins, clobbering the other's update.
- **Diagnose with data:** Reproduce with two overlapping requests; inspect that both read the same version, computed independently, and the second write overwrote the first. Audit logs show both reads preceded both writes.
- **Communicate:** "Classic lost update — both edits read the same starting state and the later save overwrote the earlier one. We need optimistic concurrency."
- **Root-cause fix:** Add **optimistic locking** — a version column; the update succeeds only if the version is unchanged (`WHERE version = ?`), otherwise return a conflict for the client to merge/retry. Alternatively pessimistic `SELECT ... FOR UPDATE` for hot rows.
- **Prevention:** Version/etag on all concurrently-editable entities; conflict-aware UX (show "edited by someone else"); tests for concurrent-edit scenarios.

---

## Situation 6 — Flaky test that only fails in CI

**Symptom:** A test passes locally but fails ~1 in 20 runs in CI, often on a slower/parallel runner.

- **Approach:** Timing-dependent failure = a hidden race or an ordering assumption, exposed by CI's different scheduling/parallelism.
- **Diagnose with data:** Run the test in a tight loop with thread sanitizer/`-race`, and with artificial scheduling jitter. Find the shared state mutated without synchronization or a test that asserts on async work before it completes.
- **Communicate:** "The flake is a real concurrency bug surfacing under CI's scheduling, not 'just CI being flaky.' Quarantining without fixing would hide a production race."
- **Root-cause fix:** Synchronize the shared state (or make it per-test/immutable); replace `sleep`-based waits with deterministic synchronization (latches, awaiting completion).
- **Prevention:** Run tests with race detection and parallelism in CI; ban `sleep`-to-synchronize; treat flakes as bugs, not noise.

---

## Situation 7 — Livelock from naive retry/backoff

**Symptom:** Under contention, two services keep retrying conflicting operations; CPU is high but success rate collapses.

- **Approach:** High CPU + no progress + mutual retrying = **livelock**, not deadlock.
- **Diagnose with data:** Traces show repeated acquire→conflict→release→retry cycles in lockstep; success throughput near zero while attempt rate is high.
- **Communicate:** "They're politely retrying into each other forever. We need to break the symmetry."
- **Root-cause fix:** Add **randomized exponential backoff with jitter** so retries desynchronize; cap retries; consider a single coordinating arbiter or queue to serialize the contended operation.
- **Prevention:** Standard backoff-with-jitter library on all retry paths; load tests that include high-contention scenarios; alert on retry-rate vs success-rate divergence.
