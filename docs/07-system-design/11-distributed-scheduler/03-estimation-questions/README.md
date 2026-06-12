# Distributed Scheduler Design — Estimation Questions

[← Topic overview](../README.md)

> Topic: Exactly-once execution, leader election, clock skew, partition tolerance.

---

## E1. Distributed task scheduler: execution throughput

**Assumptions**
- 10M registered tasks. 60% are daily cron, 20% hourly, 10% per-minute, 10% one-shot.
- Daily tasks: 6M firing once/day = 6M executions/day.
- Hourly: 2M × 24 = 48M executions/day.
- Per-minute: 1M × 1,440 = 1.44B executions/day.
- One-shot: 1M spread over the day.
- **Total: ~1.5B executions/day.**

**Peak throughput**
- Avg: 1.5B / 86,400 ≈ 17,400 executions/sec.
- Midnight thundering herd: 6M daily tasks fire within a 60s jitter window = 100k/sec burst.
- With jitter: 6M / 60s = 100k/sec. Without jitter: 6M in ~1s = catastrophic.

**Scheduler scanning**
- Each scheduler node owns a partition of ~1M tasks. Scans `WHERE next_fire_at <= now()` every tick (1s). With an index on `(partition_key, next_fire_at)`, this is a range scan — efficient.

**Execution queue sizing**
- At 100k/sec burst, Kafka with 100 partitions = 1k messages/sec per partition. Well within Kafka's capacity.
- Workers: if avg execution = 100ms, one worker handles 10 tasks/sec. For 100k/sec burst: 10,000 workers needed. Autoscale from a baseline of 2,000.

**Storage**
- Execution records: 1.5B/day × 500 B = 750 GB/day. Retain 30 days = 22.5 TB. Partition by date, drop old partitions.

**Key takeaway:** the midnight burst (100k/sec) is the design constraint, not the average. Jitter and autoscaling are essential.
