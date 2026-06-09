# Mentorship — Decision & Tradeoff Questions

[← Topic overview](../README.md)

> Topic: Unblocking juniors, code review culture, growing others.

Each prompt frames mentorship tradeoffs. Recommendation + "what would change the answer."

---

### D1. A junior is stuck. Give them the answer vs let them struggle vs pair through it?

**Recommendation: Pair through it** for most cases of genuine learning value — you transfer capability and unblock without creating dependency. Give the answer outright only under urgency (prod down). Let them struggle (with a time cap and a check-in) when the problem is well within reach and the struggle is the lesson.

**What would change the answer:** urgency (tell + debrief later); repeated stuck on the same thing (pair + give the pattern explicitly, it's a gap); or a confident mid-level who just needs a nudge (a question, not a pairing session).

---

### D2. Block a junior's PR on a non-critical style issue vs approve and follow up later?

**Recommendation: Approve with a non-blocking "nit:" comment.** Don't gate delivery on style; mark it optional and let them choose. Reserve "request changes" for correctness, security, and design. Blocking on nits slows the team and signals review is about control, not quality.

**What would change the answer:** if the "style" issue is actually a correctness or maintainability landmine (e.g., a pattern that will cause bugs), it's not a nit — block and explain why.

---

### D3. Mentor someone privately (give advice) vs sponsor them (advocate publicly for a stretch role)?

**Recommendation: Do both, but recognize sponsorship is the scarcer, higher-impact act.** Mentorship builds the skill; sponsorship spends your credibility to create the opportunity that proves it. If someone is ready and you only ever advise, you're under-investing.

**What would change the answer:** if they're not yet ready for the stretch, lead with mentorship and build toward sponsorship; sponsoring someone into a role they'll fail at hurts them and your credibility.

---

### D4. Enforce your preferred pattern in review vs let the author's reasonable-but-different choice stand?

**Recommendation: Let reasonable alternatives stand.** If their approach is correct, maintainable, and within team conventions, "I'd have done it differently" is not a reason to change it. Enforce only where there's a real correctness, consistency, or maintainability cost. Over-enforcing kills ownership and motivation.

**What would change the answer:** a documented team standard exists (enforce it, or change the standard); or the difference creates real divergence/confusion across the codebase.

---

### D5. Give a struggling teammate a stretch assignment vs keep them in their comfort zone?

**Recommendation: Stretch with a safety net.** Growth happens just past current ability. Pair them, define a clear escape hatch, and check in. Comfort-zone-only work stagnates people. But a stretch *without* support sets them up to fail and lose confidence.

**What would change the answer:** if they're already overloaded or in a fragile moment, stabilize first; if they're disengaged, a stretch with high autonomy can re-energize — or a smaller, winnable challenge to rebuild momentum.

---

### D6. Spend an afternoon unblocking a junior vs ship your own high-priority feature?

**Recommendation: Usually unblock the junior** — your leverage as a senior is the team's output, not just your own. An afternoon that unblocks someone for a week is a great trade. Protect *some* maker-time, but mentorship is part of the job, not a distraction from it.

**What would change the answer:** a true critical-path deadline where you're the only one who can ship it (do your feature, arrange someone else to unblock); or a junior who needs to push through this one themselves for the learning.

---

### D7. Address a recurring quality problem with one engineer directly vs raise it as a team-wide process change?

**Recommendation: Match the fix to the scope.** If it's one person's gap, give direct, private, specific feedback and a path to improve — don't punish the whole team with process. If multiple people hit it, fix the *system* (linter rule, checklist, template, training), not the person.

**What would change the answer:** evidence it's systemic (others make the same mistake) flips it to a process fix; making it process when it's one person is conflict-avoidance and erodes the team.

---

### D8. Run a thorough, teaching-heavy review on every PR vs lightweight reviews to maximize throughput?

**Recommendation: Calibrate to risk and author.** Deep, teaching reviews for risky changes and junior authors where the learning compounds; lighter reviews for low-risk changes and trusted authors. Uniform exhaustiveness either bottlenecks delivery or under-protects critical code.

**What would change the answer:** security/payment/data-migration code warrants deep review regardless of author; a hotfix during an incident warrants a fast review with a follow-up.
