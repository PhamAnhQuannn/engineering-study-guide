# Metrics & Experimentation — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Read data, A/B testing, success criteria.

Each prompt presents named options. Give a reasoned recommendation, then "what would change the answer."

---

### D1. A/B test vs. staged rollout vs. ship-to-everyone.

**Options**
- **A — Full A/B test** with control/treatment and a pre-committed sample size.
- **B — Staged/canary rollout** (1% → 10% → 100%) watching guardrails.
- **C — Ship to 100%** and watch dashboards.

**Recommendation:** If the goal is to *measure causal impact* on a product metric and you have enough traffic → **A**. If the goal is to *limit blast radius of a risky change* (infra, migration) rather than measure lift → **B**, optionally with a held-back control segment so you still get a directional read. **C** only for low-risk, trivially-reversible changes or when traffic is too low to learn anything.

**What would change the answer:** Traffic volume (low traffic makes A underpowered → prefer B with diff-in-diff), reversibility (one-way migrations can't A/B → B), and network effects (social/marketplace interference may force geo/cluster randomization or rule out a clean A/B).

---

### D2. One primary success metric vs. a dashboard of many.

**Options**
- **A — Single pre-declared primary metric** + guardrails.
- **B — Many metrics, decide holistically after.**
- **C — One composite OEC** blending several goals.

**Recommendation:** **A** for most experiments — a pre-declared primary avoids multiple-comparisons false positives and HARKing, while guardrails catch side effects. Use **C** when the decision genuinely trades off competing goals (e.g., engagement vs. revenue) and you can weight them sensibly in advance. Avoid **B**: post-hoc "holistic" reading is where cherry-picking creeps in.

**What would change the answer:** Exploratory/early-stage research (where you legitimately want to observe many signals, with results treated as hypotheses not conclusions) leans toward a broader read — but then you must replicate before acting.

---

### D3. Stop the experiment early (it looks significant) vs. run to planned end.

**Options**
- **A — Stop now**, ship the apparent winner.
- **B — Run to the pre-committed end date/sample.**
- **C — Switch to a sequential-testing method** that permits valid early stopping.

**Recommendation:** **B** if you committed a fixed sample size up front (the standard frequentist setup) — stopping on a peek inflates false positives. **C** is the principled way to *get* early stopping: adopt always-valid/sequential or Bayesian methods *designed* for it, ideally chosen before launch. **A** (ad hoc early stop on a fixed-N test) is the trap.

**What would change the answer:** A genuine emergency — a guardrail breach (errors, latency, refunds) — justifies stopping the *treatment* immediately for safety, regardless of statistics. Safety stops and significance stops are different decisions.

---

### D4. Quantitative metrics vs. qualitative research to decide a feature's fate.

**Options**
- **A — Trust the numbers** (A/B, funnels).
- **B — Trust user interviews / session replays.**
- **C — Triangulate both.**

**Recommendation:** **C.** Quant tells you *what* happened and how much; qual tells you *why*. A feature can test flat in aggregate yet interviews reveal it's mis-discovered, not unwanted (fixable). Conversely, users *say* they want something they don't actually use. Lead with quant for magnitude/causation, use qual to explain and to generate the next hypothesis.

**What would change the answer:** Low traffic makes quant underpowered → weight qual more heavily. High-stakes, high-volume decisions → demand quant confirmation before rollout even if qual is enthusiastic.

---

### D5. Optimize for a leading metric vs. wait for the lagging metric.

**Options**
- **A — Optimize the leading metric** (activation, week-1 retention) now.
- **B — Wait for the lagging metric** (LTV, churn) to confirm.

**Recommendation:** Steer by **A** but validate the link. Leading metrics let you iterate fast; the risk is optimizing a proxy that doesn't actually drive the lagging goal (Goodhart). So periodically confirm the leading→lagging correlation holds with longer-horizon cohort analysis or holdbacks, and pair leading targets with guardrails.

**What would change the answer:** If the leading-to-lagging relationship is unproven or weak, you're flying blind — invest first in establishing that link before optimizing the proxy. Long sales cycles may force more reliance on leading indicators by necessity.

---

### D6. Lower the MDE to detect a small effect vs. accept a larger MDE for a faster test.

**Options**
- **A — Small MDE:** large sample, long run, detects subtle lifts.
- **B — Larger MDE:** smaller sample, faster, only catches big effects.

**Recommendation:** Match MDE to **the lever's leverage and the cost of the change**. On a high-volume surface (checkout, signup) where a 0.5% lift is worth millions, a small MDE (A) justifies the longer run. For a low-traffic feature or a cheap, reversible change, a larger MDE (B) gets you a decision quickly; a tiny effect there isn't worth months of test time.

**What would change the answer:** Available traffic caps how small an MDE is feasible at all; a strict deadline pushes toward B; high reversibility lowers the cost of a false negative, favoring B.

---

### D7. Report a "significant" tiny effect as a win vs. call it immaterial.

**Options**
- **A — Report the statistically significant result as a win.**
- **B — Flag that the effect, while significant, is too small to matter.**
- **C — Recommend ship only if cumulative/compounding value justifies it.**

**Recommendation:** **B/C.** Statistical significance with a trivial effect size is the classic large-N illusion. Be honest that it's "real but small," then judge practical significance: on a massive surface even a 0.1% lift may compound to real money (C), but a 0.1% lift on a niche feature is noise worth ignoring (B). Never let "significant" alone justify shipping.

**What would change the answer:** Scale and compounding — the same tiny percentage is immaterial on a small surface and material on a huge one. Implementation/maintenance cost of the change also factors in.
