# Communication — Knowledge / Study Notes

[← Topic overview](../README.md)

> Topic: Design docs, RFCs, stakeholder mgmt, push-back.

> **🛒 Where we are in building ShopFast** — In the previous topic we learned how to [grow the engineers picking up ShopFast's slices](../../03-mentorship/01-knowledge/README.md). Now the team needs to make a decision that affects more than one squad: should ShopFast's REST (Representational State Transfer) API versioning strategy use URI versioning (`/v1/orders`) or header versioning? This is a cross-cutting concern — it cannot be decided in one person's head. This topic teaches how to write a clear RFC (Request For Comments), tune it to different audiences, and drive alignment without endless meetings. **Next:** once you can communicate and align people, you need to [lead a cross-team project to completion](../../05-project-leadership/01-knowledge/README.md).

---

## Teaching arc: writing the API versioning RFC for ShopFast

### What it is & why it matters

**Communication** at senior level means making complex decisions legible to many different people — engineers, product managers, and executives — each of whom needs a different level of detail. The leverage of a senior engineer comes from aligning people on the right thing through clear writing (design docs, RFCs), audience-tuned messaging, and the ability to **push back with data** without burning relationships.

Why do seniors get paid extra for this? Because the most expensive communication failure is a **surprise** — a stakeholder who finds out at the wrong time, through the wrong channel, with no warning. The second most expensive failure is a decision that was technically correct but never got buy-in, so it got reversed or ignored. Good communication is the primary tool for preventing both.

### A ShopFast case

**Framing.** ShopFast has been live for three months. The team is planning a breaking change to the orders API — adding a required `shipping_address` field to `POST /v1/orders`. Two mobile clients and a third-party integration are already using the API. The senior engineer needs to propose a versioning strategy before the change lands. Left undocumented, everyone will have a different opinion and the decision will be relitigated in every future PR.

**Writing the RFC.** The engineer drafts an RFC using the standard skeleton: Context/Problem → Goals & Non-goals → Proposed design → Alternatives considered → Tradeoffs/risks → Rollout/migration → Open questions.

The **BLUF (Bottom Line Up Front)**: "We should adopt URI versioning (`/v1/`, `/v2/`) for ShopFast's public API, because it is visible in logs and dashboards, easy to route and cache, and familiar to clients. Header versioning is rejected because it is invisible in URLs (harder to debug and cache) and has weaker tooling at our scale."

**Non-goals** section: "This RFC does not cover internal service-to-service versioning (handled via gRPC (Remote Procedure Call) field compatibility), nor does it cover SDK client versioning." Non-goals are as important as goals — they prevent scope creep in comments.

**Alternatives considered**: URI versioning vs header versioning vs additive-only evolution. Each alternative includes *why it was rejected*, not just that it was. Reviewers trust this section most because it proves the author did not tunnel-vision.

**Pre-socialization.** Before sending the RFC to the full team, the engineer shares it 1:1 (one-on-one) with the mobile lead (who has the strongest opinion) and the product manager (who cares about the timeline). Both surface objections privately — the mobile lead wants a longer migration window; the PM wants to know the user impact. The engineer updates the RFC before the wide review. The meeting becomes a ratification, not a debate.

**Audience tuning at the all-hands.** The engineer presents the RFC three ways: to engineers — the technical tradeoffs, caching semantics, routing implications; to the product manager — timeline, which clients need changes and when, user impact; to the CTO (Chief Technology Officer) — "We are adopting a versioning convention now so that future API changes never break clients without a migration window. The cost is one additional header in every request; the benefit is confidence to evolve the API without emergency rollbacks."

**Outcome.** The RFC is approved in one review cycle (versus the two previous RFCs that needed three rounds). The mobile lead's migration window concern is addressed in the rollout section. ShopFast ships the `v2` endpoint two weeks later with zero client breakage.

### How to handle it

1. **Lead with BLUF.** Put the conclusion and recommendation in the first paragraph. Busy reviewers should get the decision and the "so what" immediately; detail follows for those who need it.
2. **Use the RFC skeleton.** Context → Goals/**Non-goals** → Proposed design → **Alternatives considered** → Tradeoffs/risks → Rollout → Open questions. Non-goals bound the discussion; Alternatives considered builds reviewer trust.
3. **Pre-socialize with key stakeholders.** Share 1:1 with the people most likely to have strong objections *before* the wide review. Surface and fix objections privately, arrive with allies, turn the review meeting into ratification.
4. **Tune altitude to the audience.** Engineers want technical tradeoffs. Managers want timeline, scope, and risk. Executives want the business outcome and the single decision they need to make — abstract away the mechanism entirely.
5. **Push back with data + an alternative + business framing.** "No" is a conversation-stopper. "Here is the cost of that path, and here is a better way" is productive pushback. Pick the right venue: private first for sensitive disagreements, public for decisions requiring broad input.
6. **Apply "no surprises."** Surface bad news early and proactively. The worst communication failure is a stakeholder discovering a problem through a channel other than you.

For **async vs synchronous (sync) communication**: default to writing for anything non-trivial or that others will reference. Switch to a call when there have been more than two round-trips with no convergence, or for sensitive, high-emotion topics.

### A strong answer sounds like

> "When we needed to standardize API versioning at ShopFast, I wrote an RFC using the standard skeleton — BLUF first, then goals, non-goals, the proposed design, and — critically — an 'Alternatives considered' section with reasons for rejection. Before the wide review I pre-socialized with the mobile lead and the PM. The mobile lead had a legitimate concern about the migration window that I had underestimated; I added a 90-day deprecation period with a `Deprecation` header and updated the doc. When we got to the team review, the objections were already resolved. The whole thing was ratified in one session. The PM asked me to present it to the CTO — I cut the technical detail entirely and framed it as: 'We are buying ourselves the ability to evolve the API without emergency rollbacks.' That is what an executive needs to hear. The lesson: pre-socialization is not politics, it is respect — you surface the real objections before someone has to defend a position publicly."

STAR (Situation, Task, Action, Result): Situation is a cross-cutting API versioning decision, Task is driving alignment without a three-round debate, Action is BLUF RFC + non-goals + alternatives + pre-socialization + audience tuning, Result is one-round ratification and zero client breakage on launch.

### Pitfalls

- **Burying the lede** — recommendation hidden after pages of context.
- **Writing chronologically** — narrating your discovery process instead of structuring for the reader's decision.
- **Wrong altitude for the audience** — drowning execs in implementation detail, or giving engineers only the business gloss.
- **No "alternatives considered"** — looks like you didn't think; reviewers can't trust the choice.
- **Surprising stakeholders with bad news** — the single biggest trust-killer.
- **Litigating tense disagreements in writing** — escalates; switch to sync.
- **Confusing communication with broadcasting** — sending info does not equal achieving shared understanding; confirm it landed.
- **Pushing back without an alternative** — being the "no" person instead of the "here's a better way" person.
- **Re-opening decided issues** — failing to disagree-and-commit.

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
Concise, frequent, factual status updates to a known channel: what's impacted, what you're doing, ETA (estimated time of arrival)/next update time. Separate the *fixer* from the *communicator* in a serious incident so neither job starves the other.

### Saying "I don't know"
Senior communicators are precise about confidence. "I don't know, I'll find out by X" builds more trust than confident hand-waving. Calibrated uncertainty is a strength.

---

## Key terms & definitions

| Term | Definition |
|------|-----------|
| BLUF (Bottom Line Up Front) | Lead with the conclusion. |
| Design doc | Written plan of how/why before building. |
| RFC (Request for Comments) | A proposal circulated for feedback to build consensus. |
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
