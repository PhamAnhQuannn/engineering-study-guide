# Communication — Real-World Situations

[← Topic overview](../README.md)

> Topic: Design docs, RFCs, stakeholder mgmt, push-back.

On-the-job scenarios. Each follows: **model the approach → diagnose → communicate → resolve/fix → prevention.**

---

### S1. Your RFC has stalled — 40 comments, no convergence, and it's blocking the team

**Approach:** Comment threads have hit diminishing returns. Drive to a decision.

**Diagnose:** Cluster the comments — are they about goals, a specific tradeoff, or unstated assumptions? Usually 2–3 real points of contention hide under 40 comments.

**Communicate:** Summarize the points of disagreement in the doc, then call a short, focused sync with the key stakeholders and a named decider. Pre-socialize your preferred resolution 1:1 first.

**Resolve:** In the meeting, decide each contested point, record the decision and dissent in the doc, and close the rest as resolved. Disagree-and-commit.

**Prevention:** For future RFCs, set a review deadline, name the decider up front, and switch to sync after two non-converging round-trips instead of letting threads sprawl.

---

### S2. An exec asks "why is this taking so long?" and you need to explain a deep technical reason

**Approach:** Translate up — give the business framing, not the architecture lecture.

**Diagnose:** Identify the real driver (e.g., "the legacy data model can't represent the new requirement without a migration") and what the exec actually needs (impact, options, decision).

**Communicate:** BLUF: "It's slower because of a foundational data issue; we have two options — a 2-week safe migration or a risky shortcut. I recommend the migration; here's the tradeoff in one line." Offer the decision, not the mechanism.

**Resolve:** Get the call, document it, and give a revised timeline with a clear next update.

**Prevention:** Build a habit of proactive milestone updates with risk callouts so the "why is this slow" question is answered before it's asked — no surprises.

---

### S3. You strongly disagree with your manager's technical direction

**Approach:** Push back with data and an alternative, privately first, then commit to the outcome.

**Diagnose:** Pin down *why* you disagree — is it a real risk you can quantify, or a preference? Gather evidence.

**Communicate:** 1:1 first, framed constructively: "I'm worried this approach risks X — here's the data, and here's an alternative that gets the same outcome with less risk." Avoid making it public or personal.

**Resolve:** If they agree, great. If they decide differently anyway and it's not unsafe/unethical, disagree-and-commit, record your view, and support execution fully.

**Prevention:** Build enough trust that disagreement is welcomed, and surface concerns early in the design phase when they're cheap to act on, not after commitment.

---

### S4. A cross-team dependency owner keeps missing commitments and your project is at risk

**Approach:** Make the dependency and the risk visible without blame.

**Diagnose:** Confirm the facts — what was committed, what slipped, the impact on your critical path. Understand *their* constraints (maybe they're overloaded or de-prioritized you).

**Communicate:** Talk to the owner directly first, assuming good intent. If it persists, escalate with data to the shared manager — framed as "here's the risk to the goal and the options," not "they're failing."

**Resolve:** Negotiate a firm date, a reduced scope, or a workaround (stub/mock the dependency to unblock). Make the decision and new commitment explicit and written.

**Prevention:** Establish dependency tracking with explicit owners and dates up front, and a regular cross-team sync so slips surface early, not at the integration deadline.

---

### S5. You shipped a decision in a meeting, but a week later people are re-litigating it

**Approach:** Re-litigation usually means the decision and rationale weren't recorded or weren't truly understood.

**Diagnose:** Check — was the decision written down with the *why* and the alternatives? Is genuinely new information surfacing, or is it the same debate?

**Communicate:** Point to the written decision and rationale. If nothing material changed, respectfully close it: "We decided this for X reasons; what's new?" If something *did* change, reopen it deliberately.

**Resolve:** If it was never recorded, write the ADR now with the rationale and dissent so it stops recurring.

**Prevention:** Record every load-bearing decision as an ADR — context, decision, alternatives, dissent, and a review trigger — so revisiting is principled, not endless.

---

### S6. During a major outage, stakeholders are flooding channels asking for updates and distracting the responders

**Approach:** Separate communication from firefighting.

**Diagnose:** The responders are being interrupted; stakeholders are anxious because there's no single source of truth.

**Communicate:** Appoint an incident communicator to post crisp, regular updates to one known channel — impact, current actions, next update time — and direct all questions there. Free the engineers to fix.

**Resolve:** Maintain the cadence until resolution, then send a clear "resolved" with a follow-up promising a postmortem.

**Prevention:** Define incident roles (commander, communicator, responders) and a comms template in the runbook *before* the next incident so the structure is automatic under pressure.
