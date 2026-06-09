# Mentorship — Real-World Situations

[← Topic overview](../README.md)

> Topic: Unblocking juniors, code review culture, growing others.

On-the-job scenarios. Each follows: **model the approach → diagnose → communicate → fix → prevention.**

---

### S1. A junior keeps getting blocked on the same kind of problem every week

**Approach:** Solving it again won't help. Find and close the underlying gap.

**Diagnose:** Look across the incidents — is it the same concept (e.g., async/promises, the build system, a domain model)? It's a knowledge gap, not bad luck.

**Communicate:** Privately and supportively: "I've noticed we keep hitting X together — want to spend 45 minutes so you own it going forward?" Frame as investment, not criticism.

**Fix:** Pair on it deeply once, explain the underlying model, point to a reference, then have *them* drive the next instance while you watch. Move them down the show→pair→watch→delegate ladder.

**Prevention:** Capture the pattern in team docs/onboarding so the next junior doesn't hit the same wall, and check whether tooling or naming made it confusing.

---

### S2. A senior peer's code reviews are harsh and juniors have stopped opening PRs early

**Approach:** The review *culture* is damaging psychological safety. Address it without a public confrontation.

**Diagnose:** Read recent reviews — are they nitpicky, decree-style, ego-driven? Are juniors batching huge PRs to avoid review pain (a symptom)?

**Communicate:** Talk to the peer privately, assume good intent: "Your technical feedback is great, but I think the tone is making folks avoid early reviews — can we separate nits from blockers and explain the why?" Bring specifics.

**Fix:** Establish team review norms together: prefix nits, "request changes" only for real issues, explain reasoning, review promptly. Model it yourself in your own reviews.

**Prevention:** Document the review guidelines, normalize small early PRs, and celebrate good review interactions so the culture self-reinforces.

---

### S3. You're becoming the single point of knowledge for a critical system (high bus factor risk)

**Approach:** Being the hero is a liability. Deliberately spread the knowledge.

**Diagnose:** Identify what only you know — undocumented tribal knowledge, the on-call you always take, the module nobody else touches.

**Communicate:** Tell your manager this is a risk and propose a plan to de-risk it; it's a maturity signal, not an admission of weakness.

**Fix:** Document the system, run a walkthrough/brown-bag, pair others into on-call, and *deliberately route the next related task to someone else* with you supporting. Resist the urge to "just do it faster myself."

**Prevention:** Make knowledge-sharing routine (rotation of on-call, design docs, recorded walkthroughs) so no single person becomes irreplaceable.

---

### S4. A talented mid-level engineer is ready for more but keeps getting passed over

**Approach:** They have a sponsorship gap, not a skill gap. Spend your credibility.

**Diagnose:** Confirm they're genuinely ready (recent work demonstrates the next level). Identify where the visibility is missing — are they doing great work invisibly?

**Communicate:** Advocate for them in rooms they're not in — name them when their work comes up, recommend them for a high-visibility stretch project, and tell *them* specifically what to demonstrate for the next level.

**Fix:** Sponsor them into a stretch assignment with a safety net, credit them publicly for the outcome, and feed concrete evidence to their manager/promo committee.

**Prevention:** Make visibility structural — rotate who presents at reviews, who leads design discussions — so good work isn't invisible by default.

---

### S5. During an incident, a junior froze and a fix you'd have made in minutes took an hour

**Approach:** Mid-incident, prioritize resolution; the teaching comes after, blamelessly.

**Diagnose:** In the moment, the gap is incident skills (runbooks, where to look, staying calm under pressure), not intelligence.

**Communicate:** During: calmly direct, take the wheel if needed, narrate what you're checking so they learn even while you fix. After: a blameless debrief focused on the *system*, not their freeze.

**Fix:** Write/improve the runbook for that failure, pair them as secondary on the next few incidents so they build the muscle in lower-stakes moments.

**Prevention:** Runbooks for common failures, game-day/chaos drills so juniors practice incidents safely, and a blameless culture so freezing isn't shameful.

---

### S6. A junior disagrees with your review feedback and pushes back

**Approach:** Welcome it — pushback is a sign of engagement and safety, not insubordination.

**Diagnose:** Is their reasoning actually sound? Separate "they're right and I missed context" from "they have a gap."

**Communicate:** Engage on the merits, not authority: "Good question — walk me through your reasoning." If they're right, say so openly (this builds enormous trust). If not, explain the why you originally glossed over.

**Fix:** Either accept their approach (and thank them) or, if they're mistaken, teach the underlying concept rather than pulling rank.

**Prevention:** Frame reviews as conversations, ask questions rather than issue decrees, and openly admit when you're wrong so disagreement stays safe and productive.
