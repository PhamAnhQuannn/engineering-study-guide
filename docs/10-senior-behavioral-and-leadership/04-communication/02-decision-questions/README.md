# Communication — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Design docs, RFCs, stakeholder mgmt, push-back.

Each prompt frames communication tradeoffs. Recommendation + "what would change the answer."

---

### D1. Write a design doc/RFC vs just start building and discuss in PRs?

**Recommendation: Write a doc for anything significant, cross-cutting, or hard to reverse.** A doc forces clear thinking, enables async review at scale, and creates durable rationale before code locks in the design. For small, reversible, single-author changes, skip the doc and discuss in the PR — a doc there is pure overhead.

**What would change the answer:** the larger the blast radius, the number of stakeholders, or the cost of reversal, the more a doc pays off; a spike/prototype may precede the doc when the design is too uncertain to write yet.

---

### D2. Resolve a tense disagreement async (in comments) vs synchronously (call)?

**Recommendation: Switch to sync once it's tense or stalled.** Written threads escalate emotional disagreements (no tone, slow round-trips, public audience). A 15-minute call resolves what 40 comments won't. Use async for the *record* and low-emotion detail.

**What would change the answer:** if the disagreement is purely factual/technical and calm, async with data may resolve it fine; time-zone-distributed teams may need a structured async format with an explicit decider.

---

### D3. Pre-socialize a big proposal 1:1 first vs present it cold to the whole group?

**Recommendation: Pre-socialize.** Meet key stakeholders 1:1 before the wide review to surface objections privately, sharpen the doc, and arrive with allies. Cold-presenting a big proposal invites public pushback, derails the meeting, and can sink a good idea on first impression.

**What would change the answer:** small, low-stakes proposals don't need it; a genuinely open brainstorm where you *want* unfiltered group input is the exception.

---

### D4. Lead the exec update with the technical detail vs with the business outcome (BLUF)?

**Recommendation: BLUF with the business outcome and the one decision you need.** Execs optimize for "what's the impact and what do you need from me." Bury the mechanism in an appendix for those who want it. Leading with architecture loses the room.

**What would change the answer:** a technical audience (architecture review) inverts this — lead with the technical substance; a hybrid audience needs a clear summary then layered depth.

---

### D5. Over-communicate status (frequent updates) vs minimal updates to avoid noise?

**Recommendation: Tune cadence to audience need, and bias toward proactivity for bad news.** A weekly crisp summary beats daily noise *and* beats silence. The non-negotiable: never let stakeholders be surprised — surface risks and slips early even between regular updates.

**What would change the answer:** during an incident or a hot launch, frequency goes way up; a stable long-running project needs only milestone-level updates.

---

### D6. Push back on a decision you disagree with vs disagree-and-commit silently?

**Recommendation: Push back *before* the decision, with data and an alternative; commit *after*.** Voicing a well-reasoned objection is your job; staying silent and later saying "I knew it" is the worst outcome. Once decided, support it fully and don't re-litigate.

**What would change the answer:** if the decision is unethical, unsafe, or legally risky, escalate rather than commit; if it's a reversible two-way door, voice it lightly and move on fast.

---

### D7. Document decisions in a durable doc/ADR vs keep alignment in chat/meetings?

**Recommendation: Durable doc/ADR for decisions of record.** Chat and meeting memory evaporate and get re-litigated. A written decision with rationale and dissent gives newcomers the why and ends circular debates. Use chat/meetings to *reach* the decision, then record it.

**What would change the answer:** trivial reversible calls don't need an ADR; fast-moving early-stage work may keep lighter records, but anything load-bearing still gets written down.

---

### D8. As communicator during a serious incident: one person both fixes and updates vs split the roles?

**Recommendation: Split the roles.** A dedicated incident communicator (or commander) gives stakeholders timely, factual updates while engineers focus on the fix. One person doing both means either the fix or the comms starves — usually the comms, which then breeds panic and pinging.

**What would change the answer:** a tiny low-severity incident with one engineer can combine the roles; the larger the blast radius and audience, the more essential the split.
