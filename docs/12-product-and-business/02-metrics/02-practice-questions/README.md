# Metrics & Experimentation — Practice Questions

[← Topic overview](../README.md)

> Topic: Read data, A/B testing, success criteria.

A mix of recall, "explain to a junior," and multiple-choice. Answer before reading the model answer.

---

### Q1. What does a p-value actually mean, and what are two common misinterpretations?

**Answer:**
A p-value is the probability of observing data *at least as extreme as what you saw, assuming the null hypothesis (no effect) is true* — i.e., P(data | H₀). If p < α (commonly 0.05) you reject H₀.
Two common misreadings: (1) "p-value = probability the feature works / the hypothesis is true" — wrong; it's conditioned on H₀ being true, not on your hypothesis. (2) "p = 0.04 means there's a 4% chance the result was luck" — also wrong; it's the chance of *this data under H₀*, not the chance the conclusion is wrong. The correct posterior depends on prior probability and power, which the p-value alone doesn't give you.

---

### Q2. Explain statistical significance vs. practical significance to a junior.

**Answer:**
Statistical significance asks "is this effect probably real, not noise?" Practical significance asks "is the effect big enough to care about?" With a very large sample you can detect a 0.02% conversion lift as statistically significant, but rolling it out may not be worth the engineering or risk. Conversely, a promising-looking 5% lift might be statistically insignificant if your sample is tiny. You need **both**: a result that's unlikely to be noise *and* large enough to matter. Always look at the **effect size and confidence interval**, not just the p-value.

---

### Q3. Why is reporting an average often misleading? What's better?

**Answer:**
Averages are distorted by skew and outliers, which is the norm for latency and many product metrics. "Average latency 200 ms" can hide a p99 of 4 seconds that's furious-making for 1% of users. Better: report the **distribution via percentiles** — p50/p90/p95/p99. Tail latency (p99) often matters more than the mean for user experience and SLOs. Also watch **Simpson's paradox**: an aggregate average can move opposite to every subgroup if the segment mix shifts.

---

### Q4. What is "peeking" in A/B testing and why is it dangerous?

**Answer:**
Peeking is repeatedly checking results while the test runs and stopping as soon as it crosses significance. Each look is another chance to cross the p < 0.05 line by pure noise, so the *effective* false-positive rate balloons far above 5% — you'll "find" wins that don't exist. The fix is to **fix the sample size / run duration in advance** (computed from MDE and power) and only evaluate at the end, or use methods explicitly designed for continuous monitoring (sequential testing, always-valid p-values, Bayesian approaches with proper stopping rules).

---

### Q5. How do you decide the sample size and duration for an experiment before launching?

**Answer:**
You set four things first: the **primary metric**, the **minimum detectable effect (MDE)** you care about, the **significance level α** (usually 0.05), and the **power 1−β** (usually 0.80). Plug the baseline rate and its variance into a power calculation to get the **required N per arm**. Then divide by your traffic rate to get duration — and extend it to cover at least one full weekly cycle to absorb day-of-week effects and let novelty effects settle. Smaller MDE or lower baseline rate → larger N and longer run.

---

### Q6. Signups rose 8% the week you launched a feature. How confident are you the feature caused it?

**Answer:**
Not very, without a control. A week-over-week jump is *correlated* with launch but could be a marketing campaign, seasonality, another deploy, or a press mention. To claim causation you need a **counterfactual**: ideally an A/B test or a **holdback group** that didn't get the feature; failing that, a **difference-in-differences** against a comparable segment, or **interrupted time series**. The senior move is to be calibrated: "plausibly contributed, but X also launched that week; to attribute cleanly I'd need a randomized comparison." Overclaiming causation from a launch-week correlation is a classic trap.

---

### Q7. What are guardrail metrics and why do they matter?

**Answer:**
Guardrails are metrics that must *not* regress even if your primary metric improves — e.g., p95 latency, error rate, churn, refund rate, unsubscribe rate. They prevent local wins that are global losses: a checkout redesign that lifts conversion 3% but spikes payment errors and refunds is a net loss. Define guardrails up front and treat a guardrail breach as a reason to *not* ship even a "winning" treatment. They're the experimentation equivalent of "first, do no harm."

---

### Q8. What is Goodhart's law and how does it apply to product metrics?

**Answer:**
"When a measure becomes a target, it ceases to be a good measure." Once a metric drives incentives, people (and systems) optimize the metric rather than the underlying goal, often via shortcuts that defeat the intent. E.g., targeting "messages sent" invites spammy auto-messages; targeting "tickets closed" invites premature closures. Mitigations: pair the target with a **counter metric** (spam reports, reopen rate), measure outcomes not proxies where possible, and rotate/review metrics so gaming is caught.

---

### Q9 (MCQ). Your A/B test reaches p = 0.03 on day 2 of a planned 14-day run. What's the right action?

A. Ship immediately — it's significant.
B. Keep running to the pre-committed end date, then evaluate.
C. Stop the test and declare no effect.
D. Add five more metrics and check those too.

**Answer: B.** Stopping early on a mid-run peek inflates false positives; the result may not hold. Honor the pre-committed sample size/duration. A is the peeking trap, C discards a possibly-real effect, D compounds the problem with multiple comparisons.

---

### Q10 (MCQ). A 50/50 experiment is actually splitting 47/53 across millions of users. This indicates:

A. Normal random variation — ignore it.
B. A Sample Ratio Mismatch suggesting broken randomization; investigate before trusting results.
C. The treatment is winning.
D. You need a larger sample.

**Answer: B.** At large N, a 47/53 split is far outside chance — it signals a bug in assignment, a redirect dropping users, bot filtering hitting one arm, etc. Until explained, the experiment's conclusions are untrustworthy regardless of the p-value.

---

### Q11 (MCQ). You test 20 independent metrics at α = 0.05 with a treatment that truly does nothing. Roughly how many "significant" results do you expect by chance?

A. 0
B. 1
C. 5
D. 20

**Answer: B.** With α = 0.05, each metric has a 5% false-positive chance under the null; 20 × 0.05 = ~1 expected false positive. This is the multiple-comparisons problem — correct with Bonferroni/BH or pre-declare a single primary metric.

---

### Q12 (MCQ). Which is the *best* north-star metric for a messaging product?

A. Total registered accounts (cumulative).
B. Total pageviews.
C. Weekly active senders (users who send ≥1 message/week).
D. Server uptime percentage.

**Answer: C.** It captures recurring core value (people actually messaging), is actionable, and predicts retention/revenue. A and B are vanity/cumulative metrics that only go up; D is an important guardrail but not a measure of delivered user value.

---

### Q13. A new fraud detector is "99% accurate." Why might it still be nearly useless?

**Answer:**
Because of the **base-rate fallacy**. If fraud is rare — say 0.1% of transactions — then among 100,000 transactions there are ~100 fraudulent. A 99%-accurate detector with a 1% false-positive rate flags ~1% of the 99,900 legitimate ones ≈ 999 false alarms, plus ~99 true catches. So among ~1,098 flags, fewer than 10% are real fraud — the **precision** is terrible despite 99% accuracy. With rare events you must look at precision/recall and the confusion matrix, not headline accuracy.
