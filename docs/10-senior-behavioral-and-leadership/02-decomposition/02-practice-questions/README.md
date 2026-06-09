# Problem Decomposition — Practice Questions

[← Topic overview](../README.md)

> Topic: Break epics into shippable slices, scoping, estimation.

A mix of recall, "explain to a junior," and multiple-choice. Answers are complete and senior-level.

---

### Q1. What's the difference between vertical and horizontal slicing, and why does it matter?

**Answer:** A horizontal slice is one full layer of the stack (e.g., all the database work, then all the APIs, then all the UI). Nothing is usable or testable end-to-end until the final layer lands, so integration risk and feedback are both deferred to the end. A vertical slice is a thin path *through every layer* for one narrow scenario — one endpoint, one record type — and it's independently shippable and demonstrable. Vertical slicing matters because it forces early integration (surfacing the scary unknowns first), delivers value or learning each iteration, and lets you ship continuously instead of in a risky big-bang.

---

### Q2. Explain "walking skeleton" to a junior.

**Answer:** Imagine you're building a house. A walking skeleton is putting up the frame, running one pipe, one wire, and one light switch that actually turns on a single bulb — end to end, even though there's one room and no furniture. In software, it's the smallest version that touches every part of the architecture: a request goes through auth, hits an API, reads/writes the DB, and renders something, even if it only handles one trivial case. Once the skeleton works, every new feature is just adding a room to a house that already has working plumbing — you're never gambling that the pieces will connect at the end.

---

### Q3. How do you estimate work you've never done before?

**Answer:** First, don't estimate it precisely — you can't. Use a timeboxed **spike** to convert the biggest unknowns into knowledge. Then estimate by **reference class**: find the most similar thing the team has actually built and adjust, rather than decomposing from zero (which triggers the planning fallacy and underestimates). Communicate the estimate as a **range** reflecting the cone of uncertainty (e.g., "2–4 weeks, tightening after the spike"), and re-estimate as you learn. If a chunk still can't be sized, it's too big or too unknown — split or spike it further.

---

### Q4. What does INVEST stand for and how do you use it?

**Answer:** **I**ndependent (deliverable on its own), **N**egotiable (the *what*, not the *how*, is flexible), **V**aluable (delivers value or learning), **E**stimable (you understand it well enough to size it), **S**mall (fits in a short iteration), **T**estable (you can define done). It's a checklist for whether a slice is well-formed. The most diagnostic ones in practice: if a slice isn't **Estimable**, you don't understand it yet (spike it); if it isn't **Independent**, you've created a sequencing dependency that risks a big-bang.

---

### Q5. Why slice risk-first instead of easy-first?

**Answer:** Easy-first feels productive and shows early progress, but it leaves the highest-uncertainty, project-killing unknown for the end — exactly when the cost and time pressure to change course are highest. Risk-first attacks the scariest assumption while you have the most flexibility and the least sunk cost. If the risky part proves infeasible, you find out in week one, not week ten. You trade the comfort of early wins for dramatically lower project risk.

---

### Q6. How do you ship a large feature incrementally without exposing a half-built product?

**Answer:** Decouple **deploy** from **release**. Ship vertical slices continuously but keep them dark behind a **feature flag** so unfinished work is in production but invisible. Use **dark launches** to exercise new code paths with real traffic without user-visible effect, and **canary/percentage rollouts** to expose the finished feature to a small cohort first. For replacing an existing system, use the **strangler fig**: route a thin slice of traffic to the new path and grow it incrementally.

---

### Q7. What is the planning fallacy and how do you counter it?

**Answer:** The planning fallacy is the systematic human tendency to underestimate how long tasks will take, because we imagine the ideal run and ignore the unknown unknowns and interruptions. Counter it with **reference-class forecasting** (anchor on actual past durations of similar work, not an imagined clean run), expressing estimates as **ranges with buffer**, decomposing big items so estimation errors don't compound silently, and tracking actuals vs estimates over time to calibrate the team.

---

### Q8 (MCQ). You're given a 6-month epic. The single best first slice is:

A. Build the complete data model for all entities.
B. A thin end-to-end path handling one happy-path scenario, shippable behind a flag.
C. The UI for every screen with mocked data.
D. The most fun, technically interesting component.

**Answer: B.** A thin end-to-end vertical slice (a walking skeleton for one scenario) proves the architecture integrates, delivers a demonstrable result, and de-risks everything after it. A and C are horizontal slices with no end-to-end value; D ignores risk and value sequencing.

---

### Q9 (MCQ). A teammate says a task is "too big to estimate." The best response is:

A. Assign it 3 weeks and move on.
B. Decompose it further or run a timeboxed spike until it's estimable.
C. Skip estimating; just start coding.
D. Escalate to the manager for a number.

**Answer: B.** "Can't estimate" is a signal of insufficient understanding. Decomposing or spiking converts the unknown into knowledge; an estimable slice is the *outcome* of understanding, not a guess pulled out of the air.

---

### Q10 (MCQ). The primary reason to define "out of scope" and "later" explicitly is:

A. To make the document longer.
B. To prevent silent scope creep and align stakeholders on what's deliberately deferred.
C. To avoid doing any documentation.
D. Because Agile requires it.

**Answer: B.** Most scope creep comes from unstated assumptions. Naming what's out and what's deferred lets you ship the core without it being perceived as cutting corners, and gives a clear place to negotiate when the deadline is fixed.

---

### Q11. How do you handle a fixed deadline that the full scope clearly won't fit?

**Answer:** With a fixed date, the lever is **scope**, never quality or correctness (cutting quality just moves the cost to later, with interest). Rank slices by value and risk, define the minimum coherent release (the must-haves), move the rest to "later," and communicate the cut scope explicitly and early. Negotiate the *what*, since the *when* is fixed. If even the must-haves don't fit, that's a real signal to escalate — surfaced now, not at the deadline.
