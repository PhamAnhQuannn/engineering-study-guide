# Decision Making — Behavioral (STAR) Questions

[← Topic overview](../README.md)

> Topic: Tradeoff reasoning, build vs buy, tech selection.

Senior STAR prompts. Each gives the question, **what good looks like**, and a concise sample answer. Use real examples; the samples are templates for structure and altitude.

---

### B1. Tell me about the hardest technical decision you've made.

**What good looks like:** A genuinely irreversible/high-stakes call, ≥3 options with criteria, who you consulted, an explicit "what would change my mind," and a follow-up review. Ownership of the outcome.

**Sample (STAR):**
- **S:** Our monolith's single Postgres was hitting write-throughput limits; we had ~6 months of runway before it tipped over.
- **T:** Decide how to scale writes without a multi-quarter rewrite, as the de facto decider for the backend group.
- **A:** I framed it as a one-way door and laid out three options: shard the monolith DB, extract the hottest write path to its own datastore, or move to a distributed SQL DB. I defined success as "sustain 3x current write QPS at p99 < 50ms with < 1 month of migration risk." I ran a one-week spike to benchmark the distributed-SQL option, consulted our SRE lead on operational load, and wrote an ADR recording the decision and the trigger to revisit.
- **R:** We extracted the write path (lowest risk, reversible per-service). Write QPS headroom went 4x; we revisited the ADR at the checkpoint and confirmed we didn't need the bigger migration. The boring, reversible option was right.

---

### B2. Tell me about a decision you got wrong.

**What good looks like:** Clean separation of decision quality from outcome, real ownership (no blaming), and a concrete process change.

**Sample:** "I chose a then-trendy NoSQL store for a feature with relational access patterns because it benchmarked well on writes. Six months later we were hand-rolling joins in application code and fighting consistency bugs. The decision was wrong because I optimized for one axis (write speed) and skipped modeling the *query* patterns. I led the migration back to Postgres, owned it in the retro, and now I make 'model the read/write access patterns first' a required step before any datastore choice."

---

### B3. Describe a build-vs-buy decision you drove.

**What good looks like:** Core-vs-context framing, 3-year TCO, exit cost, and a recommendation (not fence-sitting).

**Sample:** "We needed feature flags. I framed flags as context, not core. I compared building (≈3 engineer-weeks + ongoing maintenance + a UI) against a SaaS at ~\$X/mo. Over three years the SaaS was cheaper once I counted maintenance and on-call, and it freed the team for product work. I wrapped its SDK behind an internal interface to limit lock-in, recommended buy, and we shipped in days instead of weeks."

---

### B4. Tell me about a time you decided with incomplete information.

**What good looks like:** Reversibility framing, smallest reversible experiment, explicit assumptions with a review trigger.

**Sample:** "A launch deadline forced a caching strategy choice before we had real traffic data. I identified it as a two-way door — cache config is easy to change — so I picked conservative TTLs based on assumed read/write ratios, documented the assumptions, and added a dashboard plus an alert to validate. After launch the real hit-rate told us to lengthen TTLs; the change was a one-line config, exactly as planned."

---

### B5. Tell me about a time you disagreed with a decision but had to support it.

**What good looks like:** Disagree-and-commit in action — strong dissent *before*, full support *after*, no sabotage or "I told you so."

**Sample:** "I argued against splitting a service early, believing it was premature. The lead decided to split for team-autonomy reasons. I recorded my dissent in the ADR, then fully committed: I helped design the boundaries and wrote the migration tooling. It turned out the autonomy benefit was real for the other team. I was glad I'd committed rather than dragged my feet."

---

### B6. Tell me about a decision where you had to push back on leadership.

**What good looks like:** Data-driven pushback, business framing, offering an alternative — not just saying no.

**Sample:** "Leadership wanted to commit to a hard public-API contract before the data model was stable — an irreversible call. I pushed back with the cost: breaking changes to public APIs erode customer trust and force versioning forever. I proposed shipping the reversible internal API now and running a 2-week design partner program before freezing the public contract. They agreed; we avoided a v2 within the first quarter."

---

### B7. Tell me about a time you changed your mind based on new data.

**What good looks like:** No ego attachment, a clear trigger, and a fast pivot.

**Sample:** "I'd advocated self-hosting our search cluster. During the spike, the operational load (sharding, upgrades, on-call) measured far higher than I'd assumed for our small team. I reversed my own recommendation to a managed service, presented the new data openly, and we shipped faster with less risk. Updating on evidence beat being right."

---

### B8. How do you make sure your decisions stick and don't get re-litigated?

**What good looks like:** Written rationale (ADR), named decider, recorded dissent, and a review trigger so revisiting is principled, not political.

**Sample:** "I write a short ADR for any one-way-door decision: context, options, decision, who decided, and what would make us revisit. That gives everyone the *why*, captures dissent so people feel heard, and sets an objective trigger. When someone reopens it, we check the trigger — if nothing material changed, we point at the ADR and move on; if it did, we genuinely reconsider."
