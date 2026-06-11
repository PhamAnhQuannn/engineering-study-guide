# Metrics & Experimentation — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Read data, A/B testing, success criteria.

> **🛒 Where we are in building ShopFast** — Last topic we decided *what* to build using product thinking: we identified the JTBD (Job To Be Done), ran a RAT (Riskiest Assumption Test), and shipped a simple trending-products carousel as an MVP (Minimum Viable Product). [Product Thinking](../../01-product-thinking/01-knowledge/README.md) gave us the framework for choosing; now we need to know whether the choice was right. This topic teaches you to measure outcomes correctly — picking the right metric, designing an A/B (A/B test), and avoiding the statistical pitfalls that cause teams to ship the wrong thing with confidence. **Next:** to measure well, your mental model of the business must match how the system is actually structured — [Domain Modeling](../../03-domain-modeling/01-knowledge/README.md) makes that translation precise.

---

## Teaching arc: measuring whether the trending-products carousel actually helped ShopFast

### What it is & why it matters

Senior backend engineers are expected to *read product and system data correctly*, *design and interpret experiments*, and *define success criteria before shipping*. The bar is statistical literacy applied to product decisions — not memorizing formulas, but avoiding the costly mistakes (false attribution, peeking, vanity metrics) that lead teams to ship the wrong thing with confidence.

The core insight: **data is not automatically truth.** A spike in signups the week you launch a feature is correlated with the launch, not necessarily caused by it. A marketing campaign, a seasonal effect, or a competitor going offline could explain it entirely. The disciplines in this topic exist to separate signal from noise, and causation from correlation.

### A ShopFast case

The trending-products carousel shipped two weeks ago. The PM (Product Manager) comes to the daily standup: *"Great news — orders are up 12% this week!"* The team is tempted to declare success. Here is what a senior engineer does instead.

**Step 1 — Ask: is this causation or correlation?** The 12% lift is an observational number from a non-randomized rollout. Anything that happened the same week — a promotion email, a seasonal peak, a competitor outage — could explain it entirely. "Up 12%" is a lagging indicator with no counterfactual. It tells you what happened, not why.

**Step 2 — Design the experiment properly (A/B test).** To get a causal read, randomly split users: 50% see the carousel (treatment group), 50% see the original homepage (control group). Because assignment is random, the only systematic difference between the groups is the carousel. A difference in the metric is therefore caused by the carousel, not by confounders.

**Step 3 — Define the metric and guardrails *before* looking at data.** The pre-registered primary metric: **add-to-cart rate from the homepage within the session**. Guardrails: checkout conversion rate must not drop (the carousel might distract buyers who already had intent); p95 (95th-percentile) page load time must not regress (the image carousel adds payload). Choosing these *after* running risks HARKing — Hypothesizing After Results are Known.

**Step 4 — Size the experiment correctly.** ShopFast has ~1 M (million) users; if typical homepage add-to-cart rate is 4%, we want to detect a lift of ≥ 0.5 percentage points (the MDE — Minimum Detectable Effect). A standard power calculation at α = 0.05 (significance threshold) and power = 0.80 (80% chance of detecting a real effect) suggests roughly 120,000 users per arm. With 200,000 daily homepage visitors split 50/50, the experiment needs about two days to reach sufficient sample size. Run for at least one week anyway to avoid day-of-week effects and novelty spikes.

**Step 5 — Interpret results without common pitfalls.** After one week: treatment arm shows +0.7 pp (percentage point) add-to-cart rate; p = 0.03 (below α = 0.05 threshold); 95% CI (confidence interval) = [+0.2 pp, +1.2 pp]. Guardrails: checkout conversion flat, page load p95 up 8 ms (within budget). Correct conclusion: the carousel causes a real, practically meaningful lift. Incorrect conclusion (the peeking trap): checking after day two when p = 0.04 and declaring done — the sample was too small and early stopping inflates false positives.

**Step 6 — Report with percentiles, not means.** Page load time for the carousel shouldn't be reported as "average load: 320 ms." Report p50, p90, p99. The mean can be fine while the p99 is 3 s, which is the experience for 1% of users — roughly 2,000 users per day at ShopFast's scale.

### How to handle it

**Metric hierarchy** — Structure your metrics in layers before any experiment:
- **North-star metric** — the one number that best captures delivered user value. For ShopFast: "orders completed per week per active user."
- **Primary / success metric** — the one metric *this experiment* is trying to move.
- **Guardrail metrics** — metrics that must *not* regress. Stop the experiment if they do.
- **Counter metrics** — catch gaming. If you optimize "add to cart," watch "cart abandonment rate" and "returns rate."
- **Vanity metrics** — look good, drive no decision. "Total product impressions" is vanity if it doesn't connect to purchase intent.

**AARRR funnel (sometimes called "pirate metrics")** — Acquisition → Activation → Retention → Referral → Revenue. For backend-influenced features, Activation (the "aha moment" where a user first experiences core value) and Retention are usually the highest-leverage stages. Optimizing Acquisition (top of funnel) while Retention is broken is filling a leaky bucket.

**A/B test design checklist:**
1. Write the hypothesis and primary metric *before* running.
2. Compute required sample size from MDE + α + power.
3. Fix experiment duration in advance.
4. Check for SRM (Sample Ratio Mismatch) — if the 50/50 split lands 48/52, randomization is broken; the experiment is invalid.
5. Analyze once at the end (or use a sequential testing method if continuous monitoring is needed).
6. Check guardrails alongside the primary metric.

**Distributions over means** — For any latency or revenue metric, always report percentiles (p50, p90, p95, p99). Means hide the tail — the users whose experience is worst are also the most likely to churn.

### A strong answer sounds like

*"Before I say whether the 12% order lift is meaningful, I want to know: was there a control group, or is this just a before/after comparison? If it's a rollout without randomization, a marketing campaign or seasonal effect could explain it entirely. To get a causal read I'd want an A/B test — randomized split, primary metric and guardrails pre-declared before running, sample size computed from the MDE, no peeking until the fixed end date. And I'd report p50/p95/p99 for latency alongside the conversion numbers, not just the mean."*

Notice: distinguishes correlation from causation first, names the experimental design requirement, calls out the pre-declaration discipline, and proactively mentions percentiles.

### Pitfalls (vanity metrics, false confidence)

- **Peeking / early stopping** — checking results repeatedly and stopping when "significant" inflates false positives massively. Fix: fix sample size and duration in advance.
- **HARKing (Hypothesizing After Results are Known)** — cherry-picking the metric that happened to move and pretending it was the hypothesis.
- **Multiple comparisons** — testing 20 metrics at α = 0.05 yields ~1 false positive by chance. Pre-declare one primary metric, or apply Bonferroni/Benjamini-Hochberg correction.
- **Vanity metrics** — total signups, raw pageviews, total impressions. Look good in a deck; don't drive decisions. Always ask "what action does this metric change?"
- **Goodhart's Law** — when a measure becomes a target, it ceases to be a good measure. Optimizing "messages sent" causes spam; optimize "message replies" instead.
- **Survivorship bias** — analyzing only retained users hides why churned users left.
- **Simpson's paradox** — a trend in aggregate can reverse in every subgroup. A feature that "increased conversion" overall may have helped desktop and hurt mobile, with desktop traffic dominating the mix.

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
- Decide the **primary metric, MDE (Minimum Detectable Effect), significance level (α, usually 0.05), and power (1−β, usually 0.80)** up front, and compute required **sample size** before launch.

### Statistical concepts you must speak to
- **p-value** — probability of observing a result this extreme *if H₀ were true*. p < α lets you reject H₀. It is **not** the probability the hypothesis is true, nor the probability the result was chance.
- **Statistical significance vs. practical significance** — with huge N, a 0.01% lift can be "significant" yet worthless. Always ask whether the effect size matters.
- **Type I error (false positive, α):** ship a change that does nothing. **Type II error (false negative, β):** miss a real win.
- **Power** — probability of detecting a true effect of a given size. Underpowered tests (too few users) waste effort and produce noisy, non-reproducible results.
- **Confidence interval (CI)** — a range for the true effect; more informative than a bare p-value because it shows magnitude and uncertainty.
- **MDE (Minimum Detectable Effect)** — the smallest lift you care to detect; smaller MDE → larger sample needed.

### Common experiment pitfalls
- **Peeking / early stopping** — checking results repeatedly and stopping when it's "significant" inflates false positives massively. Fix: fix the sample size/duration in advance, or use sequential-testing methods designed for continuous monitoring.
- **Multiple comparisons** — testing 20 metrics at α=0.05 yields ~1 false positive by chance. Fix: Bonferroni/Benjamini-Hochberg correction, or pre-declare one primary metric.
- **SRM (Sample Ratio Mismatch)** — if the 50/50 split actually lands 48/52, randomization is broken (a bug, a redirect, bot filtering); the experiment is invalid until explained.
- **Novelty & primacy effects** — short-term behavior (curiosity spike, or resistance to change) differs from steady state; run long enough to see equilibrium.
- **Network effects / interference** — in social or marketplace products, treatment users affect control users, violating independence. Use cluster/geo randomization.
- **Simpson's paradox in results** — an overall win can hide a loss in an important segment.
- **HARKing (Hypothesizing After Results are Known)** — cherry-picking the metric that happened to move and pretending it was the hypothesis.

### When you can't A/B test
Not everything is randomizable (low traffic, one-way migrations, infra changes). Alternatives: **staged/canary rollout with a control segment, difference-in-differences, interrupted time series, holdback groups, pre/post with a matched control.** Be explicit about lower confidence.

---

## Key terms & definitions

- **Statistical significance** — result unlikely under H₀ (p < α).
- **Practical significance** — effect large enough to matter for the business.
- **Power** — P(detect a true effect). **MDE** — smallest detectable meaningful effect.
- **Guardrail metric** — must-not-regress metric.
- **SRM (Sample Ratio Mismatch)** — broken randomization indicator.
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
- Optimizing a metric that's easy to game (Goodhart's Law: *when a measure becomes a target, it ceases to be a good measure*).
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
- Don't **peek/stop early**; correct for **multiple comparisons**; check for **SRM (Sample Ratio Mismatch)**.
- Report **percentiles, not means**; watch **Simpson's paradox**, **survivorship/base-rate** bias.
- Beware **Goodhart/vanity metrics**; pick **actionable** metrics tied to real value.
- When you can't A/B test, use **canary + control, diff-in-diff, holdback** — and state lower confidence.
