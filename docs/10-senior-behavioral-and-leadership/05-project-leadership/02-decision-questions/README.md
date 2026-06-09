# Project Leadership — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Driving ambiguous projects, cross-team coordination.

Each prompt frames a leadership tradeoff. Recommendation + "what would change the answer."

---

### D1. Start an ambiguous project with up-front planning vs jump into building to learn?

**Recommendation: Spend the first effort reducing ambiguity, then build to learn.** Define the goal, success metric, and constraints, and run a spike on the riskiest unknown. Don't write a 6-month Gantt chart (it'll be wrong), but don't start coding blind either. Plan the spine and the next milestone; let the rest emerge.

**What would change the answer:** very high uncertainty pushes toward more spiking/prototyping and less planning; a regulated or fixed-scope project warrants more up-front planning.

---

### D2. Lead through influence vs ask for formal authority/ownership?

**Recommendation: Lead through influence by default** — credibility, a compelling plan, and making others' work easier get you further than a title, and the skill is what the role is about. Ask for explicit ownership/decider status when there's a genuine accountability gap causing deadlock.

**What would change the answer:** if repeated decisions stall for lack of a clear decider, get that authority named explicitly; if you're spending all your time persuading, a formal mandate may be the missing piece.

---

### D3. The date is at risk: cut scope vs add people vs slip the date?

**Recommendation: Cut scope first.** It's the cleanest lever and preserves quality. Adding people to a late project usually makes it later (Brooks's Law — ramp-up and communication overhead). Slipping is sometimes right but is a sponsor decision and a last resort — surfaced early with data.

**What would change the answer:** if scope is genuinely fixed (contract/regulatory), then re-baseline the date or, rarely, add people *early* and only to parallelizable work; if quality is the thing being sacrificed to hit the date, stop — that's deferred cost with interest.

---

### D4. Delegate the interesting critical-path work vs do it yourself to be safe?

**Recommendation: Delegate ownership with support.** Doing it yourself is faster once but caps the project at your bandwidth, starves others' growth, and raises bus-factor risk. Delegate with clear context and outcome, stay available, and keep yourself free to own the seams and unblock.

**What would change the answer:** an extreme-stakes, no-room-for-ramp critical path may justify you doing the riskiest piece — but pair someone in so it's not solo; if the team genuinely lacks the skill yet, pair rather than hand off cold.

---

### D5. Run heavy coordination process (RACI, status, gates) vs keep it lightweight?

**Recommendation: Match process weight to project size, risk, and number of teams.** A small single-team effort needs almost none. A multi-team, high-stakes project needs explicit roles, dependency tracking, and a status cadence — the seams are where it fails. Add process to remove a specific pain, not for its own sake.

**What would change the answer:** more teams/stakeholders and higher blast radius push toward more structure; a tight, trusted team can run lean.

---

### D6. Surface a risk to sponsors now (while uncertain) vs wait until you're sure?

**Recommendation: Surface early, with calibrated confidence.** A risk raised at week 2 is a cheap plan change; the same risk at week 10 is a crisis and a trust hit. Frame it as "here's a risk, here's the likelihood/impact, here's the mitigation" — no surprises beats false reassurance.

**What would change the answer:** truly trivial risks don't need sponsor airtime; but anything that could move the date, scope, or budget goes up early.

---

### D7. Push the team to hit an aggressive date vs protect them from burnout?

**Recommendation: Protect sustainable pace; use scope and re-baselining, not heroics, to hit dates.** Crunch buys short-term speed at the cost of quality, bugs, and attrition — net negative beyond a brief, well-justified push. Lead by cutting scope and clearing blockers, not by demanding overtime.

**What would change the answer:** a rare, genuinely critical, time-boxed event (a hard external launch) can justify a short sprint *with* the team's buy-in and recovery after; chronic crunch is always a management failure to fix, not a plan.

---

### D8. When a cross-team dependency is blocking you: build a workaround vs wait/escalate?

**Recommendation: Unblock pragmatically — stub/mock the dependency to keep moving — while escalating the real blocker with data.** Waiting idle cedes your critical path to someone else's priorities. A clean interface lets you build against a contract and integrate later.

**What would change the answer:** if a workaround would create significant throwaway work or risky divergence, escalate and re-sequence instead; if the dependency owner can deliver in days, a short wait may beat building a stub.
