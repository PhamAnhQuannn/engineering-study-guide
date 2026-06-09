# Communication — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Design docs, RFCs, stakeholder mgmt, push-back.

At senior level, communication *is* the job as much as code. The leverage of a senior engineer comes from aligning many people on the right thing — through clear writing (design docs, RFCs), audience-tuned messaging (engineers vs execs), and the ability to **push back with data** without burning relationships. Interviews probe whether you can make complex things legible, drive alignment, and disagree productively.

---

## Core concepts

### Writing for the reader, not the writer
Good technical communication starts from **what the reader needs to decide or do**, not from the order you discovered things. Two failure modes: writing a chronological brain-dump, or writing for yourself instead of the audience. Always answer "who reads this and what do they need from it?" first.

### BLUF — Bottom Line Up Front
Lead with the conclusion/recommendation, then support it. Executives and busy reviewers should get the decision and the "so what" in the first paragraph; detail follows for those who need it. Burying the recommendation on page 4 is the most common senior writing mistake.

### Design docs and RFCs
- **Design doc:** describes *how* you intend to build something and *why*, before building it. Forces thinking, creates a durable rationale, and enables async review at scale.
- **RFC (Request for Comments):** a design doc circulated specifically to gather feedback and build consensus on a proposal. Same artifact, social purpose.
- **Standard skeleton:** Context/Problem → Goals & Non-goals → Proposed design → Alternatives considered (and why rejected) → Tradeoffs/risks → Rollout/migration → Open questions.
- **Non-goals** are as important as goals — they bound the discussion and prevent scope creep in comments.
- **Alternatives considered** is the section reviewers trust most; it shows you didn't tunnel-vision.

### Audience tuning
The same decision is communicated three different ways:
- **To engineers:** the technical why, tradeoffs, implementation detail.
- **To product/managers:** impact on timeline, scope, risk, users.
- **To executives:** the business outcome, cost, risk, and the *one* decision you need from them — abstract away the mechanism.
Translate *up* (to less technical) and *down* (to more technical) fluently. The skill is knowing what to omit.

### Push-back and disagreement
Productive pushback is **data-driven, business-framed, and offers an alternative** — not "no," but "here's the cost of that, and here's a better path." Pick the right altitude and venue (private first for sensitive disagreement, public for decisions that need broad input). Once a decision is made, **disagree and commit**.

### Stakeholder management
Identify stakeholders, their interests, and their influence (a stakeholder map). Keep the right people informed at the right cadence. Surface bad news **early and proactively** — the worst communication failure is a surprise. "No surprises" is the cardinal rule of stakeholder trust.

---

## How communication works under the hood

### Written vs synchronous
- **Async/written** scales, creates a durable record, and respects time zones and deep work. Default to writing for anything non-trivial or that others will reference.
- **Synchronous** (call/meeting) is for high-bandwidth, high-emotion, or fast-iteration situations — contentious decisions, sensitive feedback, brainstorming. Don't litigate a tense disagreement over a comment thread.
- Heuristic: if it's been more than two round-trips with no convergence, switch to sync.

### Driving alignment
1. **Pre-socialize** big proposals 1:1 with key stakeholders *before* the wide review — surface objections privately, fix the doc, and arrive at the meeting with allies.
2. **Make the decision explicit:** who decides, by when, on what criteria.
3. **Record the outcome and the dissent** so it's not re-litigated.

### Communicating during incidents
Concise, frequent, factual status updates to a known channel: what's impacted, what you're doing, ETA/next update time. Separate the *fixer* from the *communicator* in a serious incident so neither job starves the other.

### Saying "I don't know"
Senior communicators are precise about confidence. "I don't know, I'll find out by X" builds more trust than confident hand-waving. Calibrated uncertainty is a strength.

---

## Key terms & definitions

| Term | Definition |
|------|-----------|
| BLUF | Bottom Line Up Front — lead with the conclusion. |
| Design doc | Written plan of how/why before building. |
| RFC | A proposal circulated for feedback to build consensus. |
| Non-goals | Explicitly out-of-scope items that bound the discussion. |
| Alternatives considered | Options evaluated and rejected, with reasons. |
| Stakeholder map | Stakeholders × interest × influence, to plan comms. |
| Pre-socialization | Getting buy-in 1:1 before a wide review. |
| Disagree and commit | Dissent before, support fully after. |
| No surprises | Surface bad news early and proactively. |
| Async-first | Default to durable written communication. |

---

## Tradeoffs

- **Brevity vs completeness:** too short omits the why; too long doesn't get read. BLUF + layered detail (summary → body → appendix) serves both skim and deep readers.
- **Consensus vs speed:** wide RFC review builds buy-in but is slow; pre-socialization + a clear decider gets buy-in faster.
- **Transparency vs noise:** over-communicating buries the signal; under-communicating breeds surprises and distrust. Tune cadence to audience need.
- **Directness vs diplomacy:** blunt is efficient but can damage relationships; over-softening obscures the message. Radical candor — clear *and* kind.

---

## Common pitfalls & misconceptions

- **Burying the lede** — recommendation hidden after pages of context.
- **Writing chronologically** — narrating your discovery process instead of structuring for the reader's decision.
- **Wrong altitude for the audience** — drowning execs in implementation detail, or giving engineers only the business gloss.
- **No "alternatives considered"** — looks like you didn't think; reviewers can't trust the choice.
- **Surprising stakeholders with bad news** — the single biggest trust-killer.
- **Litigating tense disagreements in writing** — escalates; switch to sync.
- **Confusing communication with broadcasting** — sending info ≠ achieving shared understanding; confirm it landed.
- **Pushing back without an alternative** — being the "no" person instead of the "here's a better way" person.
- **Re-opening decided issues** — failing to disagree-and-commit.

---

## What interviewers probe

- "Walk me through a design doc / RFC you wrote." → Structure, non-goals, alternatives, how you drove review and consensus.
- "How do you explain a technical decision to a non-technical exec?" → Audience tuning, BLUF, business framing, the one decision needed.
- "Tell me about a time you disagreed with your manager/PM." → Data-driven pushback, alternative offered, disagree-and-commit.
- "How do you keep stakeholders aligned on a long project?" → Cadence, stakeholder map, no-surprises, proactive bad-news.
- "How do you communicate during an incident?" → Concise factual updates, known channel, separate communicator role.

Red flags: can't adjust altitude, no written-comms habit, pushes back without data or alternatives, surprises stakeholders, or treats sending info as the goal.

---

## Quick-reference summary

- **Write for the reader's decision**, not your discovery order. Lead with **BLUF**.
- Design docs/RFCs: Context → Goals/**Non-goals** → Design → **Alternatives considered** → Tradeoffs → Rollout → Open questions.
- **Tune altitude** to the audience: engineers (tradeoffs), managers (timeline/risk), execs (business outcome + the one decision).
- **Pre-socialize** big proposals 1:1; arrive with allies and a sharper doc.
- Push back with **data + an alternative + business framing**; then **disagree and commit**.
- **No surprises** — surface bad news early and proactively.
- **Async-first** for durability; switch to **sync** for tense or high-bandwidth topics.
- Communication = **shared understanding achieved**, not information sent.
