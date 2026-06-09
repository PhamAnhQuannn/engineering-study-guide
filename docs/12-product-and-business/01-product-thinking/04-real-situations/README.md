# Product Thinking — Real-World Situations

[← Topic overview](../README.md)

> Topic: User value, prioritization by impact, MVP.

On-the-job scenarios. Each follows: **model the approach → diagnose with data → communicate → root-cause/fix → prevention.** These are how product thinking shows up in real engineering work, not abstract theory.

---

### S1. The feature shipped but nobody uses it

**Situation:** You spent six weeks building an advanced filtering panel. Two weeks post-launch, analytics show <1% of sessions touch it.

- **Approach:** Treat low adoption as a hypothesis-falsification, not a failure to hide. Was the assumption ("users want richer filtering") wrong, or is it a discoverability/UX problem?
- **Diagnose with data:** Pull the funnel — how many users *see* the entry point, hover, open it, complete a filter? If they never open it → discoverability. If they open and abandon → the feature itself misses the need. Cross-check with support tickets and a few user interviews for the *why*.
- **Communicate:** Share findings neutrally and early: "Adoption is 1%; data points to discoverability, not lack of demand — here's the evidence and two cheap fixes." Avoid defensiveness; frame as learning.
- **Root-cause fix:** If discoverability — surface the entry point, add an empty-state nudge, default a common filter. If genuine low demand — propose deprecation and redirect effort; document the learning.
- **Prevention:** Define an adoption target and instrumentation *before* building next time; ship a RAT or thinner slice to validate demand before the six-week build.

---

### S2. Scope creep is quietly sinking the deadline

**Situation:** A four-week project is in week three and only half done; each week the PM and a sales lead have added "small" requirements.

- **Approach:** Make the invisible visible. The problem isn't engineering speed; it's an uncontrolled requirement set.
- **Diagnose with data:** List the original scope vs. everything added since, with effort estimates. Show the burn-up: committed scope keeps rising faster than completion.
- **Communicate:** "Here's the original scope (X) and the additions (Y). At current velocity we finish original-only on time, or full-scope two weeks late. Which do you want?" Force an explicit tradeoff with the decision owner.
- **Root-cause fix:** Cut to the original vertical slice for launch; move additions to a fast-follow backlog, ranked by RICE.
- **Prevention:** Establish a change-control norm — new scope after kickoff displaces existing scope or moves the date; nothing is "free." Timebox and re-estimate at each addition.

---

### S3. Two teams want the same engineer-weeks

**Situation:** You're tech lead; Growth wants a referral feature, Platform wants to pay down a scaling risk. You can do one this quarter.

- **Approach:** Reframe from "whose ask wins" to "which has higher expected value, including risk."
- **Diagnose with data:** RICE both. For the scaling work, quantify the risk as cost-of-incident × probability (e.g., the DB will hit connection limits at projected Q3 traffic → likely outage). For referral, estimate reach × conversion lift.
- **Communicate:** Present both scores and the scaling risk's timeline to the deciders. Recommend explicitly; don't hide behind "it depends."
- **Root-cause fix:** Often the right call is the scaling work *if* the risk lands this quarter (an outage costs more than a delayed feature), or a thin slice of both if the referral can be RAT-tested cheaply.
- **Prevention:** Maintain a single prioritized backlog across teams with shared scoring, so these collisions surface in planning, not mid-quarter.

---

### S4. The data says one thing, the loudest customer says another

**Situation:** A key account demands a workflow change. Your product analytics show the current workflow performs well for the broad base.

- **Approach:** Both inputs are valid signals at different scales; reconcile them, don't pick blindly.
- **Diagnose with data:** Quantify reach — how many users share the account's pain vs. how many rely on the current flow? Segment the funnel by user type. Interview the account to extract the underlying *job*, which may differ from their proposed solution.
- **Communicate:** To the account: "We hear the need; here's how we'll address the job behind it without regressing others." Internally: present the segmentation so the call isn't driven by volume of complaint.
- **Root-cause fix:** Generalize the request (make it opt-in / role-based) so it serves the account without forcing it on everyone, or solve the underlying job a different way.
- **Prevention:** Build a habit of asking "for whom, and how many?" before acting on any single-source request; track requests by reach, not recency.

---

### S5. The "quick MVP" became permanent infrastructure

**Situation:** A throwaway prototype you shipped to validate an idea is now load-bearing, on the critical path, and brittle.

- **Approach:** Recognize the reclassification: a *learning bet* has become a *scaling investment*. The tech-debt you took deliberately is now a liability.
- **Diagnose with data:** Quantify the risk — error rates, on-call pages, time lost to its fragility, blast radius if it fails. Show it's no longer "throwaway."
- **Communicate:** "We validated the idea — it worked, which is why it's now critical. It was built to learn, not to last. Here's the risk and the cost to harden vs. the cost of an incident."
- **Root-cause fix:** Plan a deliberate hardening/rewrite as a scaling investment, prioritized against its risk, ideally behind a flag with a strangler-style migration.
- **Prevention:** Tag prototypes explicitly ("expires / must-harden-if-adopted by date") and set a review trigger when a learning bet crosses an adoption threshold.

---

### S6. Asked to gold-plate a low-value feature

**Situation:** A stakeholder wants pixel-perfect animations and edge-case handling on a feature used by 2% of users, while higher-reach work waits.

- **Approach:** Surface opportunity cost; resist polishing a non-differentiator.
- **Diagnose with data:** Show reach (2%) and the RICE of the polish vs. the queued higher-reach work. Map the feature on Kano — likely a basic/niche need where excellence yields little.
- **Communicate:** "This polish costs ~X weeks and reaches 2%; the same weeks on Y reach 60% with higher impact — here's the comparison." Offer a cheaper "good enough" version.
- **Root-cause fix:** Ship the adequate version; redirect saved capacity to higher-leverage work.
- **Prevention:** Anchor team norms on Kano/RICE so polish requests get weighed, not auto-accepted; reserve depth for differentiators.

---

### S7. Launch metric moved, but you're not sure your feature caused it

**Situation:** You shipped onboarding changes; signups rose 8% the same week. Leadership credits your feature; you're skeptical.

- **Approach:** Guard against false attribution — correlation isn't causation, and a launch week often coincides with marketing, seasonality, or other releases.
- **Diagnose with data:** Check for confounders (a campaign? a holiday? another deploy?). If no clean experiment exists, look at a held-out cohort, pre/post trend with a control segment, or a difference-in-differences view. Be honest about confidence.
- **Communicate:** "Signups are up 8%; my feature plausibly contributed, but a campaign launched the same week. To attribute cleanly we'd need an A/B — here's what I can and can't claim." Senior credibility comes from *calibrated* claims.
- **Root-cause fix:** Run a proper experiment (or staged rollout with a control) to isolate the effect before banking on it for future bets.
- **Prevention:** Plan attribution up front — randomized rollout or holdback — for any change you'll be judged by. (See the Metrics topic for experiment design.)
