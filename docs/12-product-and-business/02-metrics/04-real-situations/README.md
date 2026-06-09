# Metrics & Experimentation — Real-World Situations

[← Topic overview](../README.md)

> Topic: Read data, A/B testing, success criteria.

On-the-job scenarios. Each follows: **model the approach → diagnose with data → communicate → root-cause/fix → prevention.**

---

### S1. Leadership wants to ship a "winning" test that's still peeking-tainted

**Situation:** A PM excitedly reports the new banner A/B is at p = 0.02 after one day of a planned two-week run and wants to ship now.

- **Approach:** Protect the decision from a false positive without being the "no" person. The early significance is likely noise from peeking.
- **Diagnose with data:** Show the running p-value chart — it's bouncing across the threshold. Note the sample is a fraction of the pre-computed N; novelty effects also inflate day-1 numbers.
- **Communicate:** "Great early sign, but day-1 significance on a fixed-N test isn't reliable — results commonly regress. We planned 14 days for a reason. If we need a faster read, we can switch to a sequential method, but I'd recommend we let it run a few more days." Offer a path, not just a refusal.
- **Root-cause fix:** Run to the committed end (or to a sequential-test boundary). Re-evaluate against the primary metric and guardrails.
- **Prevention:** Pre-register sample size, duration, primary metric, and a "no peeking / sequential-only" policy; build the experimentation tool to hide unstable early p-values.

---

### S2. The dashboard average looks healthy but users are complaining

**Situation:** Support tickets cite slowness, yet the latency dashboard shows a steady ~180 ms average.

- **Approach:** Suspect the mean is hiding a bad tail. Averages mask the experience of the unhappy minority.
- **Diagnose with data:** Switch to percentiles — p95/p99 by endpoint, region, and device. You find p99 at 3.5 s on a hot endpoint for mobile users on a specific region/CDN edge. Segment to localize it.
- **Communicate:** "Average is fine but p99 is 3.5 s for ~3% of traffic, concentrated in region X — that's who's filing tickets. Here's the segmented breakdown." Translate the percentile into "1 in 30 requests."
- **Root-cause fix:** Address the tail (a slow query path, a cold cache, a saturated connection pool in that region). Set SLOs on p95/p99, not the mean.
- **Prevention:** Default dashboards and alerts to percentiles; alert on p99/SLO breaches, not averages; track by segment so tails don't average away.

---

### S3. An aggregate metric improved but a key segment got worse

**Situation:** A pricing-page redesign raised overall conversion 4%, so it's declared a win — but enterprise lead volume quietly dropped.

- **Approach:** Beware **Simpson's paradox** and segment-level regressions hidden by a favorable mix shift.
- **Diagnose with data:** Break conversion down by segment. The aggregate +4% is driven by a surge in low-value self-serve signups, while high-value enterprise inquiries fell 15%. Weighted by revenue, the change may be net-negative.
- **Communicate:** "Headline conversion is up 4%, but it's mix-driven: self-serve up, enterprise down 15%. By revenue this is roughly flat-to-negative — recommend we treat enterprise as a guardrail before rolling out." Show the segmented table.
- **Root-cause fix:** Adjust the design to preserve the enterprise path (or branch by segment); re-test with revenue-weighted and per-segment metrics.
- **Prevention:** Always pre-declare segment guardrails and a revenue-weighted (not raw-count) success metric for changes that touch monetization.

---

### S4. You can't A/B test a one-way infrastructure migration

**Situation:** You're moving search from service A to service B. It's a hard cutover; you can't split the same query across both for the same user cleanly, and leadership wants proof it didn't hurt engagement.

- **Approach:** Accept that a clean user-level A/B isn't available; design the best quasi-experiment.
- **Diagnose with data:** Options: **canary by traffic percentage** (route 5% of queries to B, compare CTR/latency against the 95% on A as a concurrent control), or **geo/cluster split**, or **interrupted time series / difference-in-differences** against a comparable surface that didn't change. Establish baselines first.
- **Communicate:** "A pure A/B isn't feasible for a cutover, so I'll ramp B as a canary with the rest of traffic as a concurrent control and watch CTR, latency, and zero-result rate. Confidence is slightly lower than a randomized test — here's why and what we'll monitor."
- **Root-cause fix:** Ramp gradually, comparing canary-vs-control on primary + guardrail metrics at each step; roll back instantly on regression.
- **Prevention:** Build migrations to support percentage-based dual-running and shadow traffic so future cutovers are measurable and reversible.

---

### S5. A metric is being gamed

**Situation:** After the team set "tickets resolved per agent" as a target, resolution counts soared but customer satisfaction and ticket-reopen rate quietly worsened.

- **Approach:** Recognize **Goodhart's law** — the proxy is being optimized at the expense of the goal (actually helping customers).
- **Diagnose with data:** Pair the target with counter metrics: reopen rate, CSAT, time-to-*actual*-resolution. Reopen rate up 30%, CSAT down — agents are closing tickets prematurely to hit the count.
- **Communicate:** Present the goal (happy, resolved customers) vs. the proxy (raw closes) and the counter-metric evidence, without blaming agents — they followed the incentive given.
- **Root-cause fix:** Redefine success as resolution *quality* (no reopen within N days, CSAT ≥ threshold), not raw count; remove the perverse incentive.
- **Prevention:** When setting any target, pre-define counter metrics and review for gameability; prefer outcome metrics over easily-gamed proxies.

---

### S6. The experiment is underpowered and gives a noisy "no effect"

**Situation:** A two-day test on a low-traffic feature returns p = 0.4; the PM concludes "the feature doesn't work, kill it."

- **Approach:** Distinguish "no effect" from "no power to detect an effect." A null result from an underpowered test is uninformative.
- **Diagnose with data:** Compute the achieved power for the observed sample and MDE — it may be ~20%, meaning even a real, meaningful effect would usually go undetected. The wide confidence interval likely spans both a solid win and a loss.
- **Communicate:** "This test couldn't have detected even a meaningful effect — the CI ranges from −3% to +6%. 'Not significant' here means 'we don't know,' not 'no effect.' Killing it now is a coin flip dressed as data."
- **Root-cause fix:** Either run longer to reach adequate power, pool more traffic, lower the bar to a larger MDE, or accept that this surface can't be A/B-tested and use qualitative + directional signals instead.
- **Prevention:** Compute required sample size and power *before* launching; don't start tests that can't possibly reach significance for the MDE you care about.

---

### S7. Two simultaneous experiments are interfering with each other

**Situation:** Two teams independently launched A/B tests on the same checkout flow. Both report wins; combined, conversion is flat.

- **Approach:** Suspect **interaction / interference** — overlapping treatments on the same surface and the same users violate independence; each team's "control" is contaminated by the other's treatment.
- **Diagnose with data:** Check assignment overlap and look at the four-cell interaction (neither / A only / B only / both). The "wins" may be confounded; the combined effect reveals the truth.
- **Communicate:** "Both tests ran on the same flow with overlapping users, so neither's control was clean — the individual wins aren't trustworthy. Combined, we're flat. We need to de-conflict." Keep it blameless; it's a coordination gap.
- **Root-cause fix:** Use a shared experimentation platform with mutually-exclusive assignment (layered/orthogonal experiment design) so overlapping tests don't collide; re-run cleanly.
- **Prevention:** Central experiment registry and a layering system that allocates non-overlapping or properly-orthogonalized buckets; require experiment review before launch on shared surfaces.
