# Mentorship — Behavioral (STAR) Questions

[← Topic overview](../README.md)

> Topic: Unblocking juniors, code review culture, growing others.

Senior STAR prompts. Question + **what good looks like** + concise sample answer.

---

### B1. Tell me about someone you helped grow.

**What good looks like:** Concrete actions across time (not one conversation), the ownership-transfer ladder, sponsorship, and *their* measurable outcome — credit to them, not you.

**Sample (STAR):**
- **S:** A new-grad on my team was technically capable but hesitant, opening huge late PRs and rarely speaking in design discussions.
- **T:** Help them grow into an independent, confident contributor.
- **A:** I paired with them weekly, deliberately moving from showing → pairing → watching as they took over a small service. I coached them to open small, early PRs and gave specific, why-driven review feedback. When they were ready, I sponsored them to lead a customer-facing feature and credited their work publicly in our review.
- **R:** Within two quarters they owned the service end to end, led their own design reviews, and were promoted. The service's bus factor went from one (me) to two. The win was theirs; my job was creating the runway.

---

### B2. Describe how you give code review feedback.

**What good looks like:** Separating blocking from non-blocking, explaining the why, asking questions, praising, and reviewing promptly.

**Sample:** "I prefix optional comments with 'nit:' so the author can tell what actually must change versus preference. I reserve 'request changes' for correctness, security, and design issues, and I always explain the reasoning — 'this is O(n²) in a hot loop, a map makes it O(n)' — so it teaches, not just dictates. I ask questions where I'm unsure ('what happens if this is empty?'), call out things done well, and I review within a few hours because a stuck PR blocks a person."

---

### B3. Tell me about a time you gave difficult feedback.

**What good looks like:** Specific, timely, private, with care and a path forward (radical candor / SBI), and a real outcome.

**Sample:** "A mid-level engineer was shipping fast but leaving recurring null-handling bugs that hit production twice. I sat with them privately and used SBI: the situation (two prod incidents), the specific behavior (skipping null checks on external data), the impact (on-call pages, eroded trust). Then I made it actionable — I showed them the linter rule and we added a habit of validating inputs at boundaries. I framed it as 'you're fast, let's make you reliably fast.' The incidents stopped, and they later thanked me for being direct instead of dancing around it."

---

### B4. Tell me about a time you unblocked a struggling teammate without taking over.

**What good looks like:** Coaching over solving, transferring capability, restraint.

**Sample:** "A teammate was stuck for a day on a flaky integration test. I was tempted to just fix it, but instead I asked what they'd ruled out, then guided them: 'what's different between the passing and failing runs?' That led them to a shared-state race they then fixed themselves. It took 30 minutes longer than if I'd done it, but they owned the fix and caught a similar bug solo the next week."

---

### B5. Describe a time you improved your team's engineering culture.

**What good looks like:** Systemic change (norms, safety, leading by example), not a one-off act.

**Sample:** "Reviews on my team were slow and inconsistent — some harsh, some rubber-stamps — and juniors were avoiding them. I proposed lightweight review norms: nits prefixed, blockers reserved for real issues, SLA of same-day, explain the why. I modeled it in my own reviews and gently coached peers privately. Over a couple of months PRs got smaller and more frequent, review turnaround dropped, and juniors started opening early WIP PRs for feedback — exactly the behavior we wanted."

---

### B6. Tell me about a time you sponsored someone (not just advised them).

**What good looks like:** Spending personal credibility, creating an opportunity, public credit.

**Sample:** "A quiet but strong engineer kept getting overlooked for high-visibility work. I recommended her to lead a cross-team migration — a genuine stretch — and backed her to leadership with specific evidence of her readiness. I stayed available as a safety net but let her drive and run the design review herself. She delivered it, got visible credit, and it became the centerpiece of her promotion case the next cycle."

---

### B7. Tell me about a mentorship attempt that didn't work, and what you learned.

**What good looks like:** Self-awareness, adapting approach to the person, no blaming the mentee.

**Sample:** "I tried the same hands-off, Socratic-questioning approach I'd used successfully before, with a new-grad who actually needed more direct guidance early on. They got frustrated and felt unsupported. I'd applied one style as if it were universal. I switched to more explicit pairing and a clearer structure, checked in on what *they* needed, and the relationship recovered. The lesson: mentorship is adaptive — match the support level to the person and the moment, not to your default."

---

### B8. How do you balance mentoring with your own delivery commitments?

**What good looks like:** Treating mentorship as real, budgeted work that creates leverage, not as a distraction.

**Sample:** "I treat mentorship as part of my output, not overhead — a senior is measured on team leverage. I protect some maker-time for my own critical-path work, but I deliberately budget hours for pairing, reviews, and unblocking, because an afternoon spent unblocking someone often returns a week of their throughput. When I'm on a true critical-path deadline, I'll arrange for another senior to cover unblocking rather than dropping it, so people aren't left stuck."
