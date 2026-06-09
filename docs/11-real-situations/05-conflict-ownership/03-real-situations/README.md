# Conflict & Ownership — Real-World Situations

[← Topic overview](../README.md)

> Topic: Disagreements, blameless postmortems, ownership.

On-the-job scenarios about disagreement, accountability, and ownership. For each: **model the approach → engage with data/empathy → communicate → resolve constructively → prevention.** The senior signal: depersonalize conflict, let evidence decide, fix systems not people, and own outcomes (including the ones that "aren't your job").

---

### S1. Two engineers deadlocked on a core design decision

**Scenario:** Two strong engineers on your team have been arguing for a week about whether to use a relational or document store for a new service. The debate is heated and starting to feel personal; the project is blocked.

- **Approach:** Depersonalize and move from positions to interests. "Relational vs. document" is a positional stalemate; the real question is what each *needs* (strong consistency for one part? schema flexibility for another?).
- **Engage with data:** Define the decision criteria *first* (consistency, query patterns, scale, team familiarity, reversibility), then resolve the open questions with a timeboxed spike/benchmark instead of trading opinions. Often the interests reveal a synthesis (relational for the transactional core, document for the flexible part).
- **Communicate:** Reframe the discussion around the shared goal and the criteria, not who's "right." Keep it about the system.
- **Resolve:** If still split after the data, present both options + tradeoffs to a designated decider and **disagree-and-commit**. Make sure both engineers feel heard so the loser commits genuinely.
- **Prevention:** Adopt a lightweight ADR + agreed decision-criteria process so future technical disagreements are resolved by data and explicit tradeoffs, not endurance.

---

### S2. Running a blameless postmortem after an engineer caused an outage

**Scenario:** A teammate pushed a config change that took down a service for 20 minutes. People are murmuring it was "their fault." You're facilitating the retro.

- **Approach:** Set a blameless frame explicitly at the top: "We assume everyone acted reasonably with the information they had; we're here to fix the system, not the person."
- **Engage with data:** Build a factual, timestamped timeline. Use 5 Whys / contributing factors: the config was wrong → there was no validation → no canary → no review required for config → config changes were treated as low-risk. The *system* let a reasonable action cause an outage.
- **Communicate:** Protect the engineer publicly; redirect any "Bob did it" toward "why did our process let a config error reach prod?" Reinforce that reporting honestly is the goal.
- **Resolve:** Produce action items with **owners and due dates**: config validation in CI, canary for config, a review gate. Capture what went well too.
- **Prevention:** The action items *are* the prevention; track them to completion. Normalize blameless retros so people surface near-misses instead of hiding them.

---

### S3. Disagreeing with your manager's technical direction

**Scenario:** Your manager wants to adopt a new framework you believe will create serious problems. You think it's the wrong call.

- **Approach:** Disagree with evidence and framing, not just objection. Pick this battle deliberately — is it important enough to push on?
- **Engage with data:** Prepare the concrete risks (maturity, hiring pool, migration cost, a small spike showing a specific failure) and an alternative, framed as a question: "Here's the risk I see and the data; here's what I'd propose; what am I missing?"
- **Communicate:** Make the case privately first, respectfully, focused on shared goals (delivery, reliability), not on being right. Listen for context you may lack (maybe there's a strategic reason).
- **Resolve:** If your manager still chooses the framework after a fair hearing, **disagree and commit** — back the decision and help make it succeed. You voiced the risk; the decision is theirs to own.
- **Prevention:** Document the decision and the risks you raised (an ADR) so if a risk materializes, the team learns — without "I told you so." A culture where dissent is heard means you'll be listened to next time.

---

### S4. Owning a failure that was partly someone else's fault

**Scenario:** A feature you led failed in production. Contributing factors included an unclear spec from product and a missed edge case from a teammate — but you were the lead.

- **Approach:** As the lead, own the outcome. Resist the urge to distribute blame even though factors were outside your control.
- **Engage:** Diagnose honestly — what *you* could have done differently (clarified the spec, added a review step, tested the edge case) — and the systemic gaps.
- **Communicate:** In the retro, lead with ownership: "I owned this delivery and it failed; here's what I learned and what I'm changing." Surface the unclear-spec and edge-case issues as *system* problems to fix ("we need clearer acceptance criteria"), not as deflection ("so it wasn't really my fault").
- **Resolve:** Drive the fixes — both the immediate bug and the process gaps (acceptance criteria, edge-case review).
- **Prevention:** Establish clearer requirements/acceptance criteria up front and an edge-case enumeration step in your team's process so the systemic gaps close. Modeling ownership here makes the whole team safer about admitting failure.

---

### S5. Owning a problem nobody's assigned ("not my job")

**Scenario:** You notice the deploy pipeline is flaky and occasionally ships broken builds. It's officially owned by a platform team that's swamped, and it's slowing everyone — but it's not your team's responsibility.

- **Approach:** Treat it as an ownership opportunity, not "not my job." The outcome (reliable deploys) matters more than the org chart.
- **Engage with data:** Quantify the impact — how often it fails, time lost across teams — so the problem is undeniable and prioritizable.
- **Communicate:** Raise it to the platform team with the data and an offer to help, rather than either ignoring it or unilaterally hacking on their system. Make the cost visible to leadership if it stays unowned.
- **Resolve:** Either pair with the platform team on a fix, contribute a PR they review, or — if truly un-owned — drive it to resolution yourself with their blessing. Own that it *gets fixed*, even if you don't own every keystroke.
- **Prevention:** Ensure the pipeline gets a clear owner going forward; add monitoring/alerting on deploy failures so it can't silently degrade again.

---

### S6. A peer's code review feedback feels harsh and is creating friction

**Scenario:** A senior peer leaves blunt, sometimes dismissive review comments. A junior on the team is now afraid to submit PRs, and the technical conflict is becoming relationship conflict.

- **Approach:** Separate the (often valid) technical substance from the corrosive delivery. The reviewer may be right on the merits but is damaging psychological safety.
- **Engage:** Talk to the peer privately, assuming good intent: surface the *impact* of the tone ("the feedback is good, but its delivery is making people afraid to ship"), not an accusation about their character.
- **Communicate:** Reinforce shared norms — review comments critique *code*, not people; prefer questions and suggestions over verdicts; praise as well as critique. Support the junior directly so they regain confidence.
- **Resolve:** Agree on a healthier review style; perhaps model it in your own reviews. Keep the technical rigor, lose the friction.
- **Prevention:** Establish written code-review guidelines (be kind, be specific, critique the code, explain the why); make respectful review a team value so technical conflict stays productive and doesn't curdle into relationship conflict.
