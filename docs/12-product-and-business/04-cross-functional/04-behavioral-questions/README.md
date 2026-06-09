# Cross-Functional Work — Behavioral (STAR) Questions

[← Topic overview](../README.md)

> Topic: Work with PM/design, requirement clarification, scope.

Senior behavioral prompts. Each gives the **question**, **what good looks like**, and a concise **sample STAR answer** (Situation, Task, Action, Result). Use these as templates — swap in your own real stories; specifics and measurable results are what convince interviewers.

---

### B1. Tell me about a time you clarified a vague or ambiguous requirement before building.

**What good looks like:** You didn't build on guesses; you asked the right questions (problem, success metric, unstated NFRs), wrote testable acceptance criteria, and the clarification changed the work for the better. Shows you protect the team from building the wrong thing.

**Sample STAR:**
- **S:** A PM asked my team to "add notifications" to our scheduling product — a one-line ask with huge ambiguity.
- **T:** As tech lead, I needed a buildable, correctly-scoped spec before we committed the sprint.
- **A:** Instead of estimating, I ran a 30-minute clarification: who gets notified, on what events, via which channels, at what volume (an NFR — turned out 50k/day, which ruled out synchronous sends), and what "success" was (reduce no-shows). I wrote Given/When/Then acceptance criteria and confirmed them with the PM and QA. The scale answer reshaped the design from inline sends to a queued worker.
- **R:** We shipped on time with no rework; no-shows dropped ~18%, and QA had clear criteria to verify against. The PM started bringing me requests earlier because the clarification consistently improved them.

---

### B2. Describe a time you disagreed with a PM or designer and how you handled it.

**What good looks like:** Evidence-based pushback, a concrete alternative (not just objection), respect for the decision owner, and disagree-and-commit if overruled. No ego, no silent sabotage.

**Sample STAR:**
- **S:** A PM wanted to build a complex custom-rules engine for a feature I believed served only a handful of users.
- **T:** I needed to either change the plan or get genuinely on board.
- **A:** I pulled usage data showing the target workflow covered <2% of users, estimated the rules engine at ~6 weeks, and proposed a config-driven alternative at ~1 week that covered the known cases. I presented it as "here's the data and a cheaper option," not "you're wrong." The PM weighed it and still wanted the fuller version for a strategic enterprise deal I wasn't aware of.
- **R:** Once I understood the strategic context, I committed fully and led the build. I documented the decision and its rationale in an ADR. The lesson — surface concerns with data, but the owner may have context you don't; commit once it's decided.

---

### B3. Tell me about a time you had to negotiate scope under a hard deadline.

**What good looks like:** You made the scope/time/quality tradeoff explicit, used a framework (MoSCoW / vertical slice), recommended a path, and let the owner decide — instead of silently cutting quality or missing the date.

**Sample STAR:**
- **S:** Two weeks before a contractual launch date, it was clear the full feature set wouldn't fit.
- **T:** Deliver something valuable and on-time without burning out the team or shipping junk.
- **A:** I re-estimated remaining work, classified it MoSCoW, and brought the PM two concrete options: ship the Musts as a coherent vertical slice on the date with Shoulds as a one-week fast-follow, or slip everything by two weeks. I recommended the slice and explained why the Musts alone were genuinely usable.
- **R:** We shipped the slice on the contractual date; the customer was satisfied, and we delivered the fast-follow the next week. Surfacing the tradeoff early (not at the deadline) kept trust intact.

---

### B4. Describe a time you explained a complex technical constraint to a non-technical stakeholder.

**What good looks like:** Led with business impact, offered options with quantified cost/risk, dropped the jargon, and enabled a good decision. Shows translation skill, a core senior trait.

**Sample STAR:**
- **S:** Leadership wanted a "real-time" dashboard; the underlying data could only be aggregated affordably every few minutes at our scale.
- **T:** Help them make an informed call without a database lecture.
- **A:** I framed it in their terms: "True per-second real-time means a ~$Xk/month infra increase and three extra weeks; a 2-minute refresh costs almost nothing and ships next week. For this dashboard, is sub-second freshness worth that?" I used a "live scoreboard vs. periodic news update" analogy and offered the two options with costs.
- **R:** They chose the 2-minute refresh, which fully met the actual need; we shipped quickly and saved the infra spend. Leadership later reused the framing ("what's it worth?") in other tradeoff calls.

---

### B5. Tell me about a time you unblocked a cross-team dependency.

**What good looks like:** Proactive coordination, agreed contracts/interfaces early, clarified ownership (RACI), and decoupled timelines so teams moved in parallel rather than serially.

**Sample STAR:**
- **S:** My feature depended on another team's new API, and their endpoint shape kept changing, breaking our integration repeatedly.
- **T:** Stop the rework and decouple our delivery from their churn.
- **A:** I proposed a versioned, documented contract and got both teams to agree on a v1 with a deprecation policy for future changes. I built our side against a mock of that contract behind a thin adapter, so their internal changes no longer broke us, and I clarified who owned the contract. I also added a consumer-driven contract test to catch breaking changes in CI.
- **R:** Our rework dropped to zero, both teams shipped in parallel, and we hit our date. The contract + mock pattern became the team's default for cross-team dependencies.

---

### B6. Describe a time you championed the user or business need against a purely technical preference (yours or the team's).

**What good looks like:** You prioritized user/business value over engineering elegance or novelty, made the tradeoff consciously, and can show the outcome justified it.

**Sample STAR:**
- **S:** An engineer on my team wanted to rebuild a working feature on a trendy new framework "to do it right"; users were waiting on three high-demand fixes.
- **T:** Balance long-term code health against immediate user value.
- **A:** I acknowledged the tech-debt concern but reframed around impact: the rewrite was ~4 weeks with no user-visible benefit, while the three fixes addressed the top support drivers. I proposed shipping the fixes first and scheduling a *scoped* refactor of the worst module — not a full rewrite — once they were out, with the debt logged so it wasn't forgotten.
- **R:** The fixes cut related support tickets ~30%; we did the targeted refactor the following sprint. The engineer felt heard (the debt was tracked and partly paid), and users got value first.

---

### B7. Tell me about a time a requirement or commitment changed late and you adapted.

**What good looks like:** You stayed solution-oriented (not blame-oriented), assessed feasibility quickly, brokered a realistic plan, and protected both the relationship and the delivery.

**Sample STAR:**
- **S:** Mid-project, an account manager revealed sales had promised a customer a feature variant we hadn't planned, expected in a month.
- **T:** Honor the commitment without derailing the roadmap or the team.
- **A:** Rather than push back on the process failure, I clarified what the customer *actually* needed (narrower than what was promised), scoped a minimal version that satisfied it, and showed the PM what it would displace. I recommended shipping the minimal version by the date and the rest as a fast-follow.
- **R:** We met the customer's real need on time and kept the deal; I then worked with the PM to set up a lightweight check so future sales commitments got a feasibility sanity-check before being promised, reducing surprises.

---

### B8. Describe a time you used a written document (RFC/design doc/ADR) to align stakeholders or resolve a disagreement.

**What good looks like:** You recognized that durable, async written communication beats verbal churn for non-trivial decisions; you surfaced alternatives and tradeoffs and drove alignment, leaving a record.

**Sample STAR:**
- **S:** Three teams kept verbally relitigating which service should own a shared piece of data, stalling everyone.
- **T:** Reach a durable decision and stop the circular debates.
- **A:** I wrote an RFC laying out the options, each with tradeoffs (ownership, consistency, blast radius), a recommendation, and the open questions. I circulated it for async comments, then held one focused 30-minute meeting only on the two genuinely contested points. We decided, and I captured the outcome and rationale in an ADR.
- **R:** The debate ended, the teams unblocked, and when someone tried to reopen it a month later, the ADR settled it in minutes — we only revisit on new evidence. The RFC-then-decide pattern became our norm for cross-team decisions.
