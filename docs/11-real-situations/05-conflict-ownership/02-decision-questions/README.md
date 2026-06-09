# Conflict & Ownership — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Disagreements, blameless postmortems, ownership.

Each prompt is a judgment call about disagreement, accountability, or ownership. Give the reasoned recommendation, then **what would change the answer**. The through-line: argue ideas with data, commit after decisions, fix systems not people, and own outcomes.

---

### D1. Keep pushing your position vs. disagree-and-commit

**Context:** You argued for option A; the team (and your lead) chose B. You still think A is better.

- **A — Keep advocating until they see it your way.**
- **B — Disagree and commit: back B fully.**
- **C — Comply outwardly but quietly undermine B.**

**Recommendation:** **B.** Once a reasonable decision is made through a fair process, relitigating burns trust and stalls the team; sandbagging (C) is corrosive and dishonest. Voice your concern clearly *for the record*, then commit fully — that's how senior people stay influential. Your job was to make the best case, not to win every time.

**What would change the answer:** If B crosses an **ethical, legal, or safety** line (not just "suboptimal"), you don't silently commit — you escalate explicitly and, if needed, refuse. Also, if *new* information appears later, reopening the decision is legitimate; relitigating on the *same* information is not.

---

### D2. Resolve a technical stalemate by seniority vs. by data

**Context:** Two engineers are deadlocked on a design; the discussion is going in circles.

- **A — The more senior person decides.**
- **B — Run a spike/benchmark and let data decide.**
- **C — Escalate to a manager immediately.**

**Recommendation:** **B, when the disagreement is empirically resolvable.** Convert opinion ("X is faster/cleaner") into evidence (a timeboxed spike, a prototype, a benchmark). Data depersonalizes the conflict and produces a decision everyone can trust. Deciding by seniority (A) wastes the team's reasoning and breeds resentment.

**What would change the answer:** If the question *isn't* empirically resolvable in reasonable time (a values/strategy call, or both options are fine and the cost of deciding exceeds the cost of being slightly wrong), then a designated decider should just pick — present both options + tradeoffs and **disagree-and-commit** (closer to A/C, done jointly).

---

### D3. Name the person in the postmortem vs. keep it blameless

**Context:** An engineer pushed a bad config that caused an outage. Writing the retro.

- **A — Document that the engineer made the mistake.**
- **B — Blameless: focus on why the system let a config error reach prod.**

**Recommendation:** **B.** Naming a culprit guarantees the *next* person hides their mistake and near-misses go unreported, destroying your ability to learn and therefore your reliability. The productive question is systemic: why was there no validation, no canary, no review that would have caught a bad config? Fix that. People act reasonably given their tools — fix the tools.

**What would change the answer:** If the behavior was genuinely **reckless** (knowingly bypassing safeguards, ignoring explicit warnings) — the rare "reckless" bucket in Just Culture — then individual accountability is warranted, handled privately by a manager, *not* in the shared blameless retro.

---

### D4. Blameless culture vs. accountability for repeated failure

**Context:** The same engineer has caused several similar incidents. Is "blameless" still right?

- **A — Stay purely blameless; it's always systemic.**
- **B — Keep postmortems blameless but address the pattern separately via management/coaching.**
- **C — Call them out publicly to make the point.**

**Recommendation:** **B.** The *postmortem* stays blameless (so the team keeps reporting honestly), but a *pattern* of at-risk behavior is a separate, private performance/coaching conversation — that's the Just Culture nuance. Blameless retros and individual accountability are not in conflict; they operate in different channels. C destroys psychological safety for everyone.

**What would change the answer:** If the pattern is actually the *system's* fault (e.g., this engineer keeps hitting the same missing guardrail that would trip anyone), then it's still systemic — fix the guardrail, no coaching needed.

---

### D5. Own the gap vs. "not my job"

**Context:** You spot a serious problem (a flaky deploy step, an un-owned failing service) that isn't assigned to you or your team.

- **A — Fix it / drive it to an owner yourself.**
- **B — Leave it; it's not your responsibility.**
- **C — File a ticket and move on.**

**Recommendation:** **A (or at minimum a strong C with follow-through).** Ownership means caring about outcomes, not just your assigned tasks. Either fix it, or make sure it lands with a real owner and confirm it's handled — don't just throw a ticket over the wall and assume. Seeing a problem and walking past it is a failure of ownership.

**What would change the answer:** If fixing it yourself would step on another team's ownership or you lack context to do it safely, the right move is to *raise it to the owner with urgency and offer help* rather than unilaterally changing their system. Own the *outcome* (it gets fixed), not necessarily the *keystrokes*.

---

### D6. Own a failure publicly vs. protect your reputation

**Context:** A decision you made caused a problem. In the retro/standup, how do you handle it?

- **A — Own it openly: "I made the wrong call, here's what I learned."**
- **B — Frame it as bad luck / unclear requirements / someone else's input.**

**Recommendation:** **A.** Owning your failures openly *builds* trust and credibility — it models the psychological safety you want from the team and it's what senior people do. Deflection (B) is transparent to everyone and erodes trust far more than the original mistake. Pair the ownership with the learning and the prevention.

**What would change the answer:** Almost nothing — owning the outcome is right even when factors genuinely were outside your control. The nuance: you can *also* surface systemic contributing factors (unclear requirements were a real gap) — but as "here's a system issue we should fix," not as "so it wasn't my fault."

---

### D7. Override a junior's approach vs. let them learn (and maybe fail)

**Context:** A junior is heading down an approach you think is suboptimal but not catastrophic.

- **A — Override and tell them the right way.**
- **B — Let them proceed; let the experience teach them.**
- **C — Ask guiding questions so they find the issue themselves.**

**Recommendation:** **C as the default.** Disagreeing in a way that *teaches* — surfacing the problem through questions — builds the junior's judgment and preserves their autonomy and dignity. Overriding (A) gets today's code right but stunts growth and signals you don't trust them.

**What would change the answer:** Reserve overriding (A) for genuinely **high-stakes, hard-to-reverse** calls (security, data integrity, a public API) where the cost of letting them learn the hard way is too high. Lean toward B (let them proceed) when the blast radius is small and reversible — productive failure is cheap and instructive there.

---

### D8. Escalate a disagreement vs. work it out peer-to-peer

**Context:** You and a peer can't agree on a design after genuine effort.

- **A — Escalate to your manager to break the tie.**
- **B — Keep grinding until one of you concedes.**
- **C — Jointly present both options + tradeoffs to a decider, then disagree-and-commit.**

**Recommendation:** **C.** When two reasonable engineers are genuinely stuck, escalation isn't failure — but do it *jointly and constructively*: "Here are two viable paths and their tradeoffs; we need a tiebreak," not "make my peer agree with me." Then both commit to the outcome. B (grinding indefinitely) wastes time and risks turning technical conflict personal.

**What would change the answer:** If the decision is low-stakes and reversible, don't escalate at all — flip a coin or let whoever owns the code decide, and move on. Escalation is for decisions important enough to justify a decider's time.
