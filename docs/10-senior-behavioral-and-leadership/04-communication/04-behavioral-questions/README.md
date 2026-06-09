# Communication — Behavioral (STAR) Questions

[← Topic overview](../README.md)

> Topic: Design docs, RFCs, stakeholder mgmt, push-back.

Senior STAR prompts. Question + **what good looks like** + concise sample answer.

---

### B1. Tell me about a design doc or RFC you wrote that drove a significant decision.

**What good looks like:** Clear structure (non-goals, alternatives), how you drove review and consensus, pre-socialization, and a concrete outcome.

**Sample (STAR):**
- **S:** We needed to choose how to handle our growing event-processing load; opinions were split across two teams.
- **T:** Drive an aligned decision via an RFC.
- **A:** I wrote an RFC with explicit goals and non-goals, a proposed design, and three alternatives with reasons for rejecting each. Before the wide review I pre-socialized it 1:1 with the two team leads, which surfaced an objection I addressed in the doc. In the review I named a decider and a deadline.
- **R:** We aligned in one meeting instead of weeks of debate, recorded the decision and the dissent, and shipped on the agreed approach. The "alternatives considered" section was what built reviewers' trust that we'd chosen well.

---

### B2. Describe a time you had to explain something complex to a non-technical audience.

**What good looks like:** Audience tuning, BLUF, business framing, the right level of abstraction.

**Sample:** "I had to explain to execs why a 'simple' feature needed a month. Instead of the architecture, I led with the bottom line: 'The feature needs a data migration that, done safely, takes a month; rushing it risks data loss.' I gave them two options with the business tradeoff in one line each and asked for the one decision I needed. They got it immediately and chose the safe path. The skill was deciding what to leave out."

---

### B3. Tell me about a time you disagreed with a decision and pushed back.

**What good looks like:** Data-driven, alternative offered, private-first, and disagree-and-commit afterward.

**Sample:** "My PM wanted to skip a caching layer to hit a date, which I believed would cause latency problems at launch. I pushed back privately with load-test data projecting p99 at 2x our SLO, and offered an alternative — a minimal cache we could add in two days. I framed it as protecting the launch, not as 'no.' They agreed; we shipped the cache and the launch held. Had they decided otherwise on a reversible call, I'd have committed and we'd have added it later."

---

### B4. Tell me about a time you had to deliver bad news to stakeholders.

**What good looks like:** Early, proactive, no surprises, with options and a plan — not just the problem.

**Sample:** "Two weeks before a launch I realized a dependency would slip and we'd miss the date. I didn't wait for the next check-in — I told stakeholders immediately, with the cause, the realistic new date, and two options: cut scope to hit the original date, or slip two weeks for the full feature. By surfacing it early with options, the conversation was about the decision, not the surprise. We cut scope and launched on time."

---

### B5. Describe how you kept a long, cross-team project aligned.

**What good looks like:** Stakeholder mapping, cadence, written decisions, proactive risk surfacing.

**Sample:** "On a 6-month cross-team migration I mapped stakeholders by interest and influence, set a biweekly written status with explicit risk callouts, and recorded every load-bearing decision as an ADR. When a dependency wobbled, the status update flagged it weeks early so we re-planned calmly. Nobody was ever surprised, which kept trust high and let us escalate the one real blocker before it became a crisis."

---

### B6. Tell me about a time your communication failed and what you changed.

**What good looks like:** Ownership, a specific lesson, a durable habit change.

**Sample:** "Early on I wrote a long design doc that buried the recommendation on the last page. Reviewers anchored on minor early details and the doc stalled. I owned that it was a writing failure, not a reader failure. I rewrote it BLUF — recommendation and tradeoff up front, detail below — and it got approved fast. Since then I always lead with the bottom line and layer the detail."

---

### B7. Tell me about a time you built consensus among people who initially disagreed.

**What good looks like:** Pre-socialization, finding the real crux, a clear decider, recording dissent.

**Sample:** "Two engineers were dug in on different database choices and the team was blocked. I met each 1:1 to understand their real concerns — it turned out they had *different success criteria*, not different facts. I got them to agree on the criteria first, ran a short spike on the one empirical question, and then the choice was obvious to both. I recorded the decision and the original dissent so it stayed settled."

---

### B8. How do you communicate during a high-pressure incident?

**What good looks like:** Concise factual updates, a single channel, separating fixer from communicator, no speculation.

**Sample:** "During a payments outage I took the communicator role so the responders could focus. I posted updates every 15 minutes to one channel: what's impacted, what we're doing, when the next update would come — facts only, no speculation about root cause until we knew. Stakeholders stopped pinging engineers because they trusted the channel. After resolution I sent a clear 'resolved' and committed to a blameless postmortem."
