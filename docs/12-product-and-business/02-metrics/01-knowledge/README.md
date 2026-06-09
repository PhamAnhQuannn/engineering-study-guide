# Metrics & Experimentation — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Read data, A/B testing, success criteria.

Senior backend engineers are expected to *read product and system data correctly*, *design and interpret experiments*, and *define success criteria before shipping*. The bar is statistical literacy applied to product decisions — not memorizing formulas, but avoiding the costly mistakes (false attribution, peeking, vanity metrics) that lead teams to ship the wrong thing with confidence.

---

## Core concepts

### Metric types and the metric hierarchy
- **North-star metric** — one metric capturing core delivered value (e.g., "weekly active senders," "nights booked"). Aligns the org; should predict long-term revenue.
- **Primary / success metric** — the one metric a specific change is trying to move.
- **Guardrail metrics** — metrics that must *not* regress (latency p95, error rate, churn, unsubscribe rate). They stop you from winning the battle and losing the war.
- **Counter metrics** — catch gaming: if you optimize "messages sent," watch "spam reports."
- **Vanity metrics** — look good, drive no decision (total registered users, raw pageviews). Contrast with **actionable metrics** that change behavior.

### AARRR ("pirate metrics") funnel
Acquisition → **Activation** → Retention → Referral → Revenue. Each stage is a measurable conversion. Activation (first experience of core value, the "aha moment") and Retention are usually the highest-leverage for backend-influenced products.

### Averages lie — use distributions and percentiles
- The **mean** is distorted by outliers and skew. For latency and most product metrics, report **percentiles**: p50 (median), p90, p95, p99. "Average latency 200 ms" can hide a p99 of 4 s that's enraging 1% of users.
- **Simpson's paradox** — a trend in aggregate can reverse within every subgroup. Always check whether a segment mix is driving an aggregate change.
- **Survivorship bias** — analyzing only users who stuck around hides why others left.

### Rates, ratios, and base rates
- Prefer **rates/ratios** (conversion %, error rate) over raw counts when traffic varies.
- **Base-rate fallacy** — ignoring the underlying prevalence makes a "99% accurate" detector nearly useless if the event is rare (most positives are false). Critical when reasoning about fraud/anomaly systems.

### Cohort analysis
Group users by a shared start characteristic (signup week) and track behavior over time. A **retention curve** that flattens (rather than decaying to zero) signals product-market fit. Cohorts separate "the product changed" from "the user mix changed."

---

## Experimentation (A/B testing)

### The model
Randomly assign users to **control** (existing) and **treatment** (change). Because assignment is random, the only systematic difference is the treatment, so a difference in the metric is *causal*. This is what separates "8% lift correlated with launch" from "the feature caused 8%."

### Hypothesis & success criteria — defined *before* running
- **Null hypothesis (H₀):** treatment has no effect. **Alternative (H₁):** it does.
- Decide the **primary metric, minimum detectable effect (MDE), significance level (α, usually 0.05), and power (1−β, usually 0.80)** up front, and compute required **sample size** before launch.

### Statistical concepts you must speak to
- **p-value** — probability of observing a result this extreme *if H₀ were true*. p < α lets you reject H₀. It is **not** the probability the hypothesis is true, nor the probability the result was chance.
- **Statistical significance vs. practical significance** — with huge N, a 0.01% lift can be "significant" yet worthless. Always ask whether the effect size matters.
- **Type I error (false positive, α):** ship a change that does nothing. **Type II error (false negative, β):** miss a real win.
- **Power** — probability of detecting a true effect of a given size. Underpowered tests (too few users) waste effort and produce noisy, non-reproducible results.
- **Confidence interval** — a range for the true effect; more informative than a bare p-value because it shows magnitude and uncertainty.
- **Minimum Detectable Effect (MDE)** — the smallest lift you care to detect; smaller MDE → larger sample needed.

### Common experiment pitfalls
- **Peeking / early stopping** — checking results repeatedly and stopping when it's "significant" inflates false positives massively. Fix: fix the sample size/duration in advance, or use sequential-testing methods designed for continuous monitoring.
- **Multiple comparisons** — testing 20 metrics at α=0.05 yields ~1 false positive by chance. Fix: Bonferroni/Benjamini-Hochberg correction, or pre-declare one primary metric.
- **Sample Ratio Mismatch (SRM)** — if the 50/50 split actually lands 48/52, randomization is broken (a bug, a redirect, bot filtering); the experiment is invalid until explained.
- **Novelty & primacy effects** — short-term behavior (curiosity spike, or resistance to change) differs from steady state; run long enough to see equilibrium.
- **Network effects / interference** — in social or marketplace products, treatment users affect control users, violating independence. Use cluster/geo randomization.
- **Simpson's paradox in results** — an overall win can hide a loss in an important segment.
- **HARKing** — Hypothesizing After Results are Known; cherry-picking the metric that happened to move and pretending it was the hypothesis.

### When you can't A/B test
Not everything is randomizable (low traffic, one-way migrations, infra changes). Alternatives: **staged/canary rollout with a control segment, difference-in-differences, interrupted time series, holdback groups, pre/post with a matched control.** Be explicit about lower confidence.

---

## Key terms & definitions

- **Statistical significance** — result unlikely under H₀ (p < α).
- **Practical significance** — effect large enough to matter for the business.
- **Power** — P(detect a true effect). **MDE** — smallest detectable meaningful effect.
- **Guardrail metric** — must-not-regress metric.
- **SRM** — sample ratio mismatch; broken randomization.
- **OEC (Overall Evaluation Criterion)** — a single combined success metric balancing competing goals.
- **Counterfactual** — what would have happened without the change; the control approximates it.
- **Survivorship / selection bias** — conclusions skewed by who's in the sample.

---

## Tradeoffs

- **Speed vs. confidence** — shorter tests / smaller N decide faster but risk false conclusions. Pick MDE and power to match the decision's stakes.
- **One primary metric vs. many** — many metrics catch side effects but inflate false positives; resolve with a pre-declared primary + guardrails (or an OEC).
- **Sensitivity vs. cost** — detecting tiny effects needs huge samples and long runtimes; only chase small MDEs when the lever is high-volume.
- **Statistical rigor vs. organizational reality** — perfect experiments are slow; sometimes a directional read plus guardrails is the right call. Say so explicitly.

---

## Common pitfalls & misconceptions

- "p-value = probability the feature works." **False** — it's P(data | H₀).
- "Significant = important." **False** — check effect size and guardrails.
- Reporting the **mean** for skewed data instead of percentiles.
- **Peeking** and stopping early; **HARKing** after the fact.
- Optimizing a metric that's easy to game (Goodhart's law: *when a measure becomes a target, it ceases to be a good measure*).
- Ignoring **guardrails** — a conversion win that tanks latency or spikes refunds is a net loss.
- Confusing **correlation with causation** in observational launch data.

---

## What interviewers probe

- *"Signups jumped 8% after your launch — did your feature cause it?"* — Demand confounders, control/holdback, and calibrated attribution.
- *"How do you design an A/B test for feature X?"* — Hypothesis, primary metric + guardrails, MDE, power, sample size, run-length, success criteria *before* launch.
- *"Your test hit p=0.04 after three days. Ship it?"* — Spot the peeking/early-stopping trap; was sample size pre-committed?
- *"Average response time is fine but users complain — why?"* — Percentiles vs. mean; tail latency.
- *"What metric would you pick for this product and why?"* — North-star reasoning, leading vs. lagging, guardrails, gaming resistance.
- Red flags: quoting p-values as "probability it works," ignoring guardrails, no pre-registration, reading causation from correlation.

---

## Quick-reference summary

- Define **primary metric + guardrails + MDE + power + sample size before launching**.
- **A/B = randomization → causation;** without randomization you get correlation, so be calibrated.
- **p-value = P(data | H₀)**, not P(hypothesis true). Significant ≠ important — check **effect size**.
- Don't **peek/stop early**; correct for **multiple comparisons**; check for **SRM**.
- Report **percentiles, not means**; watch **Simpson's paradox**, **survivorship/base-rate** bias.
- Beware **Goodhart/vanity metrics**; pick **actionable** metrics tied to real value.
- When you can't A/B test, use **canary + control, diff-in-diff, holdback** — and state lower confidence.
