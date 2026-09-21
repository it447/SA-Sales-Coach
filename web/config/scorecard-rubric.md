Scale Army AE Scorecard
AI Scoring Reference — v7.1 · Updated September 15, 2026. Ground truth for evaluating AE call transcripts and recordings.


Start Here — How This Works
Every call gets evaluated with two tools. They answer two different questions.

Tool
Question It Answers
Output
SQL Check
Is this prospect a real opportunity?
Yes / No / Unclear
Call Scorecard
How well did the rep execute?
Score out of 75


Run both on every call.

SQL tells you whether the prospect clears the five qualification gates. A rep can run a perfect call and still get SQL = No if the prospect fails a hard gate such as timing, Authority, budget, full-time need, or company size. That's not a rep failure — that's a qualification outcome.
The Scorecard tells you how skilled the rep was across every dimension. This is the coaching tool. Scores here drive what gets worked on in post-mortem sessions.

Scoring system, for now: 8 categories, scored from transcript only, weighted by revenue impact rather than split evenly. Category 1 (Script & Call Flow) and Category 6 (Objection Handling) carry 12 points each — the original 10-call audit found the money leaking at the close attempt and the first objection more than anywhere else. Categories 3, 4, 5, and 7 carry 10 points each. Category 2 (Rapport) carries 6 points — real, but not a named revenue driver on its own. Category 8 carries up to 5 points for word-choice-visible energy failures, capped low because it's only measuring the sliver of tonality that survives transcript-only scoring, not because tonality matters less. 75 points total. Pass = 53/75 (70%). Body Language (Category 9) and the audio half of Category 8 are out of scope until video scoring comes back into play.

Inputs: Scored from transcript only for now.

Hard boundary rule: Every category scores one thing only. If a behavior could fit two categories, it belongs in the one that owns it by definition below. Do not double-penalize the same behavior across categories.

Wording flexibility: Every required question and example script in this document — the Connect questions, the Decision Point question, the probe/provoke/bridge/shutting-doors questions, the 11 scoping questions in Category 7 — illustrates the intent, not a line to match verbatim. If the AE asks something worded differently that gets at the same thing and surfaces the same information, it counts as asked. Score whether the intent landed, not whether the wording matches.

Required vs. optional questions: Every required question below is sourced from the live call script and marked accordingly. Required questions must all be asked (or surfaced-and-built-on) somewhere in the relevant layer — asking just one when a layer lists four does not satisfy the layer. Any question labeled "optional follow-up" is a suggested deepener the AE can use if they need more before moving on — it is never required and its absence is never a deduction.

Version check: Every scorecard states the rubric version it was scored against. A version mismatch against this document gets flagged at the top of the output, not passed over silently.

Self-consistency check: Before a scorecard is finalized, no finding in it may contradict another finding in the same document. A line quoted as evidence in one category cannot be marked "never happened" or "not asked" in another category or in the summary. Resolve the contradiction before output.

Incomplete calls: If the transcript or recording ends before a stage or objection resolves, mark that element "Unresolved — insufficient data" rather than defaulting to a failing score or a terminal SQL outcome.

Off-transcript judgment calls: Some scores depend on something no transcript states outright — most commonly, whether a required action should have happened given real constraints in play (see Category 6's Step 3 for the concrete version). Don't require the prospect to have said the words out loud, and don't require the reviewer to be certain of a counterfactual nobody can fully verify — a rep's coherent, deliberate execution of an alternative path is itself evidence, not an absence of it. The real test is whether the reason is material — a structural fact already on record (other real stakeholders, a stated process, a genuine constraint) — versus a guess with nothing behind it. Material facts that are already on record don't need separate confirmation just because they weren't spoken aloud as an objection. State the read before finalizing rather than assuming silently: "Scoring this as [material fact] applying — flag if that read is wrong."


Tool 1 — SQL Check
Purpose: Determine whether this prospect qualifies as an SQL. Run this first — it sets context for everything else.
SQL = Yes (all five must be true)
Full-time hiring need — there is a dedicated, ongoing hire/business need that calls for a full-time person, not a project-based, freelance, temporary, or part-time need.
Hiring within 30 days — the search is active or imminent and the prospect intends to move on the hire within the next 30 days, not "later this year" or "2–3 months out."
Final decision authority confirmed — the person on the call can independently authorize moving forward. Other people may advise, give input, review scope, or process payment, but no other person has required sign-off or veto power over the purchase. See the Authority rule below.
Budget accepted at $3K+/month — the AE quoted an all-in monthly number of $3,000 or more and the client accepted that price as workable by the end of the call, whether immediately or after objection handling. The call cannot end with the prospect still rejecting the price as "too expensive" or unaffordable.
Company size above 1–10 employees — the company has more than 10 employees. See the sourcing rule below.
Authority — binary rule
Authority is determined by veto power, not title, influence, enthusiasm, or who does most of the buying work.

Use one controlling test:

"If you want to move forward, is there anyone else you need to obtain approval from?"

No — nobody else can stop it → Authority = PASS. The prospect is the decision maker. Other people can still advise, review, or help execute the decision.
Yes — another person must approve, sign off, or can veto → Authority = FAIL. The prospect may still be a strong champion, but champion status does not check the Authority box.
Unclear — "I need to run it by the team" without knowing whether that means advice or approval → Authority = UNCLEAR until the AE isolates the decision right.

Input is not approval. Needing someone's opinion does not fail Authority unless that person can stop the purchase.

Situation
Authority
Classification / Treatment
"I make the call. I'll let my team know."
PASS
Decision maker. Close the deal.
"I want Alexander's opinion, but I can move forward either way."
PASS
Decision maker. Input is advisory. Close the deal.
"Finance just processes the invoice after I approve it."
PASS
Decision maker. Finance is administrative/payment execution only.
"Finance checks the budget but cannot reject the decision once I authorize it."
PASS
Decision maker. Payment process is separate from Authority.
"My partner / CEO has to approve this."
FAIL
Champion if personally sold and able to drive the process. Close their personal yes, then get the approver involved.
"Finance / procurement can reject or withhold approval for the spend."
FAIL
Another party has veto power over the purchase.
"My team needs to help finalize what this role should own, but I can authorize the hire myself."
PASS on Authority
Scope is unresolved, not Authority. Run the scope-input path; do not falsely mark Authority as failed.
"I'm gathering options for my boss; they make the decision."
FAIL
Influencer unless/until the actual decision maker is engaged.


Champion definition: A champion is personally a yes, wants the deal to happen, and can materially drive the internal process — but another identified person still has required approval or veto power. Champion ≠ Authority. The AE should still close the champion on their personal commitment and the approval path.

Scope-input rule: A stakeholder whose input is needed to finalize responsibilities, seniority, or requirements does not automatically own decision authority. Score Authority only on veto/sign-off power.

To determine whether that unfinished scope is material enough to block decision-readiness, the AE should ask, in order:

"What specifically do you still need their input on?"
"Could that materially change the responsibilities, seniority, must-haves, ownership, or budget — or are they mostly pressure-testing what we've already defined?"
If material: "Who needs to weigh in?"
"What exactly do we need them to decide before the role is final?"
Minor input — a nice-to-have, wording change, or non-material preference that wouldn't change the search or price band. Doesn't block decision-readiness or the close.
Material input — could change the function, responsibilities, seniority, must-haves, ownership, or budget/price band. The role is not decision-ready. The AE must recap what's already agreed, name the unresolved elements, state whether the budget range is firm or provisional, and lock a specific follow-up with the right people.

A material unfinished scope can still make the deal not decision-ready and require a scope-resolution follow-up, but that is a Scope/Role Qualification issue, not an Authority failure unless that stakeholder also has approval rights. Categories 6 and 7 both grade against this same test — see those sections for what each one specifically scores on top of it.
SQL = No (any one of the five disqualifies)
Trigger
Sounds Like
No full-time need
"Part-time is fine," "just a few weeks," "20 hours a week is enough," or the need is only project/freelance/temporary
Not hiring within 30 days
"Maybe in a few months," "2–3 months out," "come back in Q4," or another clearly beyond-30-day timeline
Another person has required approval / veto power
"My partner / co-founder / CEO / Alexander has to approve this," "Finance can reject the spend," "I can't move forward without my boss signing off"
Budget rejected or below $3K
AE's quoted all-in monthly number is below $3K, or the prospect ends the call clearly rejecting $3K+ pricing as too expensive / unaffordable
Company size 1–10 employees
"It's just me and one other person," "we're a 5-person shop," or verified company context confirms 10 or fewer employees

SQL = Unclear — unresolved / insufficient data
Use this outcome instead of forcing a Yes/No when one of the five SQL criteria is unresolved. This includes:

The transcript or recording ends before a live objection affecting one of the five criteria resolves.
Full-time need or hiring timeline was never established clearly.
Authority language is ambiguous — e.g. "I need to run it by my team" — and the AE never established whether that means advice/input or required approval/veto.
The AE quoted $3K+ but the prospect gave soft or ambiguous price resistance and the call ended before the AE established whether the price was actually workable.
Company size is missing, unsupported, or conflicting across sources.

Write it up as:

"SQL = Unclear — [specific criterion] was not resolved. [What is known]. Confirm [the missing information] before logging a final SQL outcome."

Never log a terminal SQL = No from ambiguous stakeholder or budget language alone. "I want their input" is not the same as "I need their approval," and "that's a little high" is not automatically the same as "we cannot afford it."
Company size — sourcing rule
The company-size criterion is satisfied two ways: (a) directly confirmed on the call — the prospect states team size or headcount at any point, even in passing — or (b) supplied as verified account/deal context, in which case it must be labeled with its source (CRM field, deal record, form submission) and never presented as an unattributed fact.

Binary threshold: 10 or fewer employees = FAIL. 11 or more employees = PASS. Do not use judgment to override the threshold based on perceived sophistication or hiring infrastructure.

If the transcript contradicts the supplied figure — for example, the prospect gives an explicit headcount inconsistent with the account field — flag the conflict and downgrade to SQL = Unclear until resolved. A direct headcount statement from the prospect outranks an unlabeled external figure.
Borderline cases
"I'm talking to a few companies" — Not a disqualifier. Competition is not an SQL criterion. Flag as competitive and score only the five gates.
"I'm just learning / comparing options" — The label window shopping is not an SQL criterion by itself. Diagnose the underlying facts. If the prospect still has a full-time need, is moving within 30 days, has Authority, accepts $3K+, and works at an 11+ employee company, they can still be SQL = Yes. If "just researching" actually means no active 30-day hiring plan, they fail Timing, not "Window Shopping."
"We already use offshore talent" / "We only want US talent" — Geography preference is no longer an SQL gate. Handle service-fit implications elsewhere; do not add a sixth SQL criterion.
"Do you do direct placement?" / asks about another offer model — Offer/model preference is no longer an SQL gate by itself. Handle the request commercially, but score SQL only on the five criteria above.
"I want to get my team's opinion" — Not an Authority disqualifier by itself. Ask whether the team can actually stop the decision. Advisory input = Authority PASS; required approval/veto = Authority FAIL.
"Finance needs to be involved" — Do not infer failure. If Finance only processes payment, checks paperwork, or executes an already-authorized spend, Authority can still PASS. If Finance can reject or must approve the spend, Authority FAILS.
"My team needs to weigh in on scope" — Do not fail Authority unless those stakeholders also have approval/veto rights. If their input could materially change the role, flag the scope as unresolved and run the scope-resolution path.
Company size right at the line — exactly 10 employees = FAIL; 11 employees = PASS.
"Your price is a little high" / soft, exploratory pushback — Distinguish from a hard rejection ("that's too expensive," "can't afford that"). If the AE resolves the pushback and the prospect accepts the $3K+ number as workable, Budget PASS. If the call ends with soft resistance still unresolved, SQL = Unclear on Budget. If the prospect clearly rejects the price as unaffordable, Budget FAIL.
Enthusiasm is not qualification. "This sounds great" does not clear SQL = Yes by itself. All five criteria still have to check out.
Important note on AE accountability
Any clearly failed SQL gate produces SQL = No regardless of how well the AE handles the call. That does not mean the AE gets a pass or should stop selling. SQL qualification and rep skill remain separate.

If another approver exists, the AE's job is to close the highest available commitment:

Get the prospect's personal yes: "Assuming Alexander signs off, are you personally a yes?"
Identify what the approver needs to see or believe.
Confirm when the prospect can engage them.
Lock a specific next step with the approver involved whenever possible.

A prospect can therefore be SQL = No on Authority and still be an excellent champion. The rep can run a flawless call, close the champion, and advance the buying process correctly while the lead remains non-SQL under the strict qualification rule. SQL and rep skill are fully decoupled.

Conversely, a prospect who only wants advice from their team, or whose Finance team merely processes payment, can still be Authority = PASS and should not be treated as an approval-path deal solely because someone else is "involved."


Tool 2 — Call Scorecard
Category ownership — read before scoring
Category
Exclusively Owns
1 · Script & Call Flow
Did the stages happen, in order, without looping. Correct close attempted or the appropriate approval/scope next step locked. Structure only — not content quality.
2 · Rapport
Prospect comfort and openness — converted into commercial direction, not just warmth.
3 · Discovery & Questions
Quality of questions — probe, provoke, bridge, intent. Not whether discovery happened (that's Category 1).
4 · Pitch Execution
Was the pitch customized to discovery. Deck shown. Sheet described. Terms covered. Soft closes used.
5 · Pricing & Budget Delivery
Anchor used. Casual, direct delivery. No hedging. Did not fold on price pushback. Deposit framing. Verbal delivery only — not budget acknowledgment for the role (that's Category 7).
6 · Objection Handling
Direct Diagnostic on vague objections, the right specific script on named ones, AAAR to close. Every genuine objection attempted. Never accepted on first pass.
7 · Scope & Role Qualification
Role scoping questions asked, scope creep challenged, role confirmed before call ends, budget range for the role acknowledged by client.
8 · Energy & Tonality
Word-choice-visible escalation and signal-reading, for now — vocal delivery requires audio and isn't scored.

Multi-participant calls
When more than one Scale Army employee speaks on a call, credit for the AE's own demonstrated skill in Categories 3, 4, 6, and 7 comes from their own turns only — unless the AE explicitly set up the other participant's contribution as part of their own game plan ("Luis is going to dig into the technical scope with you" counts; a silent handoff doesn't). Log every instance where a secondary participant carries a required question or scored moment as its own line, tagged "(not the AE — [Name])."

This is a skill-attribution flag, not a penalty. If a required question gets covered by a teammate, the requirement is still satisfied for the call — the AE doesn't get marked down for not asking it a second time. The tag exists so Dijah can see whose skill produced the outcome, not to punish the AE for something the client already answered.


Category 1: Script & Call Flow — /12
What it measures: Did the stages happen in order, did the call move forward without looping, and was a commercial outcome reached? Structure only — content quality is scored in its own category.

The 7 stages — structural checkpoints:

Stage
Time
Must Happen
Fail =
1 · Frame
2–3 min
Set agenda before the prospect starts talking. Position as evaluator. Must include the evaluation signal and a statement that a decision will be made by end of call.
No agenda at all, or agenda present but missing both load-bearing elements.
2 · Connect
3–5 min
Potential questions: (1) is [Role Name] the role you’re looking to hire for, (2) what made you book this call today.
Meanders. No intent gathered.
3 · Discovery
10–12 min
Rep asks layered questions before pitching. Prospect says their problem out loud before pitch starts. Rep does not move to pitch until gap is established.
One surface question then straight to pitch.
4 · Decision Point
1–2 min
Run the Authority Test from Tool 1 — ask the controlling approval question directly. If it passes, proceed. If it fails, the AE must identify the approver and later close the prospect's personal yes. Other people mentioned only for advice, Finance processing, or role input get diagnosed per the same test, not treated as approval.
Never established whether anyone else has required approval/veto power. Rep pitches blind on the buying process.
5 · Pitch
7–8 min
Pitch happens after discovery. Led with prospect's stated gap.
Pitch before discovery. Generic feature dump.
6 · Pricing
3–4 min
Price delivered. Anchor used. Pushback not folded on.
Price skipped, or folded immediately on first pushback.
7 · Close
3–5 min
Authority PASS + scope ready: close the deal, STFU. Authority FAIL: first secure the prospect's conditional personal yes; only then are they a champion. Identify the approver, what that approver needs, and lock a specific approval next step. Material scope unresolved: confirm what is already agreed, identify exactly what could still change, who needs to weigh in, and lock the scope-finalization follow-up. If the recording ends before this stage resolves, mark "Unresolved — insufficient data," not Fail.
No attempt to secure the strongest commitment the prospect actually controls. "I'll send you the deck." No specific next step.


Call flow rule: The call moves forward, not in circles. If the prospect goes off-topic, rep redirects after one exchange. If scope bloats, rep consolidates. Rep owns the structure at all times.

Frame quality note: A frame that technically happened but is missing the evaluation signal or the explicit decision-point framing is a weak frame, not a clean pass. It cannot anchor a 10–12 score on its own even if every other stage is clean — cap the category at 9 when the frame is present-but-weak, and name the specific missing element(s) in the finding.

Scoring:

10–12: All 7 stages in order, including a frame. Decision point asked. The strongest available commitment was pursued and the correct approval/scope next step was locked where a final close was not available. No circular loops.
6–9: Most stages covered but one critical structural miss — no decision point, a weak frame, no close, or call looped back without recovery.
0–5: No frame, no discovery, no decision point, no close. Call ends with prospect holding all next actions.


Category 2: Rapport — /6
What it measures: Did the rep build genuine connection AND convert it into commercial direction? Warmth that stays warm without moving the call forward is not full credit.
What great looks like:
Warm, casual open — feels like a conversation, not a pitch
Rep listens and adjusts — doesn't barrel through a script
Prospect talks freely and shares context openly
Feels like two operators talking, not a salesperson and a prospect
Rapport is used as a bridge into discovery — connection opens the prospect up, rep steers into gap questions
The signal to watch: Most of the time this isn't dramatic — it's ordinary small talk, usually about location, that the rep either carries into a business question or lets die as a pleasantry. A prospect sharing something personal or emotionally charged (burnout, frustration, a bad experience) is the rare, high-signal version of the same skill — steer toward it the same way, just don't expect it to show up often.
What it sounds like:
5–6 (bridged):
"Where are you dialing in from?" / "Austin." / "Nice, the tech scene down there's been on fire the last couple years — that kind of growth usually means hiring gets brutal too. Is that part of what's going on for you guys?" / "Yeah honestly, it's insane right now, everyone's poaching from everyone."
3–4 (same warmth, no handoff):
"Where are you calling in from?" / "Austin." / "Nice, I hear the food scene's great out there." / "Yeah it's alright." / "Cool — so let's get into it, tell me about the role."
Scoring:
5–6: Prospect talking freely. Rep listening and steering. Warmth explicitly used as a bridge into discovery or a close.
3–4: Genuine warmth, prospect comfortable — but call stays warm without converting into commercial direction.
0–2: Rep talks more than prospect. Prospect/rep are guarded. Feels like a pitch call with no real connection.

Category 3: Discovery & Questions — /10
What it measures: Quality of the rep's questions — did they surface real pain, build a gap, and give the pitch something to mirror back? This is where the sale is made or lost.

Note on boundary: Category 1 scores whether discovery happened. Category 3 scores how well. Do not deduct in both for the same failure.

Four layers — all must be present, and rep-elicited. Every required question in a layer must be asked (or surfaced by the prospect and visibly built on) — asking just one out of four does not satisfy that layer. Wording is flexible; the intent has to land. Optional follow-ups are exactly that: use them if you need more before moving on, but their absence is never a deduction.

Layer 1 — Probe (what's broken right now)

Required:

"Can you walk me through how you're currently handling [the function]? What does that actually look like right now, and how is it affecting you?" "Tell me a little more about [X]."

Layer 2 — Provoke (what is it costing)

Required:

"What kind of results are you getting with that?" "How long has this been an issue for?" "On a scale of 1–10, how would you rate how you're handling this problem right now?" "Why did you give yourself a [X]?"

Optional follow-ups (use if you need more before moving on):

"How does [this challenge] affect your operations/team/growth/etc?" "How is [X problem] affecting your [Y outcome]?" "Tell me more when you say [you need help with XYZ] — what do you mean by that?" "That sounds like a lot of stress — are you personally doing that right now?"

Do NOT ask "how does that make you feel?" Founders calculate — they don't emote. Ask about time and money.

Layer 3 — Bridge / Desired State (what does solved look like)

Required:

"If we can get that to an 8/9/10, what would that look like?" "If you had someone excellent in this role, what business outcomes would they help drive? What would the business actually look like as a result?"

Layer 4 — Preempting Objections (Shutting Doors)

Required — Priority Questions:

"That sounds pretty important. How urgent is it for you to get there?" "What's your definition of urgent? Is it fixing this issue yesterday / 2 weeks / 3 months?"

Required — Process Questions:

"Just wondering really quick — have you tried something like this before (hiring for this role yourself / using a vendor / a freelance platform)? What worked and what didn't?"


Doesn't count, even though it can look like discovery: clarifying or repeat-back questions ("so you need social, correct?"), feature preference ("do you want them to know WordPress?"), admin logistics ("30 or 40 hours?"), product qualification with no probe/provoke/bridge underneath it ("what function do you need?"), or reactive competitive intel (the prospect brings up a competitor unprompted — proactively asking about one is worth full credit, reacting to one they raised is marginal).

Rep-elicited vs. surfaced: A required question counts as demonstrated if the rep either asked it, or the prospect volunteered the material unprompted and the rep visibly used it — mirrored it back, built on it, connected it to the bridge or the pitch. Tag it "(surfaced, not built on)" only when the prospect volunteers something and the rep lets it pass without doing anything with it — that's the actual skill gap: being handed the answer and not using it. Don't penalize a rep for a talkative prospect; penalize them for missing what the prospect handed them.

Scoring:

8–10: All four layers covered — every required question in each layer asked, rep-elicited or surfaced-and-built-on. Prospect says their problem out loud. Rep can mirror pain back before pitching.
5–7: One or two required questions across the four layers are missing, or a layer's material was surfaced by the prospect but never built on by the rep. Score toward the top of this band if it's isolated and the other layers are clean.
0–4: A full layer is missing outright (none of its required questions were asked or surfaced), or three or more required questions across layers are missing. This ranks below an isolated "surfaced, not built on": getting nothing from a call that required real work to extract it is a harder failure than fumbling material that was handed over for free. Also lands here: product or admin questions only, prospect never says their problem, pitch lands on nothing.


Category 4: Pitch Execution — /10
What it measures: Was the pitch customized to what came out of discovery, and were all required elements covered?

Note on boundary: Category 1 scores whether a pitch happened after discovery. Category 4 scores how well it was executed. Do not deduct in both for generic pitch delivery.

What must happen:

Somewhere in the pitch, a generic placeholder or hypothetical gets swapped for something real from the call — a number, a name, a situation the prospect actually mentioned, not just the role they're hiring for. Doesn't have to happen in the opener, and doesn't need to be announced ("based on what you told me…") — the swap itself is the signal, not a recap of it.
Feature → benefit mapped to the prospect’s pain/desired state, not a generic walkthrough
Model explained: we run paid ads and recruiter networks per search — not a bench. GEOs: LatAm, South Africa, Eastern Europe, Middle East. NOT Asia (time zones).
Candidate sheet shown and described on screen: top 4–6 candidates, app packet (resume + 1–2 min video + desired salary), all-in salary with margin baked in
Deck shown on screen during the call — not just promised via email after
Engagement terms covered: month-to-month, 30-day trial with immediate free replacement, 30-day notice after trial, replacement guarantee never expires, deposit credited to first month ($299 if locked in within 48 hours, $600 standard), 14–20 business day timeline
Soft closes used 3–4x throughout — not only at the end

What great pitch language sounds like:

"These aren't data entry people — we consider these senior niche specialized talent as talented as someone in New York City, but for 40% less."

"We hold all the risk." — use deliberately 

"You're paying us via Stripe every month. We pay them, take our margin, handle currency conversion, all employment contracts. You just have a service agreement with us — month to month, 30 days notice."

Placeholder-swap example, at the take-home stage:

"When we get to the take-home, we'd actually build the scenario around something close to your real situation — here's a budget, here's the channel performance you're getting today, how would you reallocate it to fix [the specific gap they named] — so you're watching them solve your actual problem, not a generic case study."

What weak pitch looks like:

Pitch before discovery gap is established
Same script delivered regardless of what the prospect said
Generic hypotheticals or placeholder examples used throughout even when specific, real details from the call were sitting right there and never got swapped in
"We technically work under the model where we become an employer of record" — THIS IS WRONG. Scale Army is AOR/COR, not EOR. Flag this explicitly every time it happens.
Disclosing margin percentage unprompted, or on the first direct ask — deflect first (see Margins in Category 6). Giving the percentage is only correct on the second push, not before.
15+ minutes on industry strategy or consulting content instead of the hiring conversation

Scoring:

8–10: A real, specific detail from the call — a number, a name, a situation they mentioned — got swapped in for a generic placeholder somewhere in the pitch. All required elements covered. Soft closes used naturally throughout.
5–7: Role-specific but not prospect-specific — most elements covered, but every example and hypothetical stayed generic. Or soft closes were absent, or one required element missed.
0–4: Generic feature dump regardless of discovery. Placeholders and hypotheticals never swapped for anything real from the call, despite real material being available. Required elements skipped. No soft closes.


Category 5: Pricing & Budget Delivery — /10
What it measures: How the rep delivered the price — anchor, tone, confidence, and whether they held frame when pushed back on. Verbal delivery mechanics only. Budget acknowledgment for the scoped role is scored in Category 7.

What must happen:

Anchor before the number: "Most companies your size are looking at [high anchor] going through a US firm or retained agency. What we typically look like is [actual number]."
Deliver the number casual and direct — like you're telling someone what a flight costs
No verbal hedges immediately after the number: "just because…," "I would say…," "don't quote me on this," "it wouldn't be someone you'd want to hire at the low end"
Early bird / promo pricing mentioned with urgency framing if applicable
Deposit framing: "Most clients handle the deposit on the call — it's [X] and it comes off your first invoice." Deposit expectation follows Authority + scope readiness. If Authority PASSes and the role is sufficiently defined, the AE should attempt the deposit. Finance merely processing an invoice/card/ACH is not a reason to skip it. If another person — including Finance/procurement — has actual approval/veto power, do not penalize the AE for failing to collect money the prospect cannot authorize; close the prospect's conditional personal yes and lock the approver step instead. A deposit attempt is also not required when a material scope gap means the role is not defined enough to know what search is being purchased.
Never fold on first price pushback. Never concede on price or terms before building value first.

Pricing tonality rule: Casual + direct = correct. Casual + uncertain = wrong. The difference is what comes after the number. If verbal qualifiers follow immediately, it's uncertain — deduct here regardless of the lean-back.

Scoring:

8–10: Anchor used. Number delivered flat and direct. No verbal hedges. Held frame if pushback occurred.
5–7: Mostly clean but one miss — either no anchor, or mild hedging after the number, or slight fold on pushback before recovering.
0–4: No anchor. Apologetic delivery. Verbal hedges immediately after the number. Folded on first pushback. "Don't quote me on this" or equivalent.


Category 6: Objection Handling — /12
What it measures: Did the rep run the objection system when genuine pushback came, or did they accept objections on first pass? Wording flexibility applies here same as everywhere else — score whether the rep hit the right move for the objection, not whether they used the exact line below.

What counts as a genuine objection (must be handled):

Price is too high / competitors are cheaper (offshore or nearshore)
"I need to think about it"
Stakeholder involvement that slows the decision — must be diagnosed first; it is not automatically an objection
"Not ready to commit" / "not the right time"
Just want to learn more / window shopping / doing it themselves
Direct question about margins
Any form of hesitation that slows or stops forward momentum

What does NOT count:

Client providing context about their business
Client asking clarifying questions
Client exploring before a pitch has been made

Isolating a vague objection — Direct Diagnostic:

Use this when the objection is genuinely vague and you don't yet know what's underneath — "need to think about it," "not the right time" with no specifics attached. Skip it when the objection is already specific and named (a price number, a named competitor, a named partner) — go straight into that objection's own script instead of fishing for a different one they haven't given you.

"Can I ask you something straightforward? Often, when someone isn't completely certain about moving forward, it typically boils down to one of three things: You're not fully certain the process will find the quality of hire you need. There might be some hesitancy about trusting the company or me. You're confident this will work, but you're evaluating the financial aspect. Where do you stand amongst these three, or am I completely off base?"

AAAR — once you have the real objection. Cycle every time a new one surfaces. Always reclose. Some objections below skip the Ask step because the objection is already specific enough to answer directly — that's intentional, not a gap.

Step
What to Do
Agree
Neutralize. Show you're on the same team against the issue.
Ask
Isolate further if the objection still isn't specific enough to answer.
Answer
Address it directly now that you have it.
Reclose
Re-ask for the close. Always. Answering without reclosing is the most common mistake.

The objection set
Just Wanna Learn More — "I just wanna know how much / learn about process / etc."

Answer: "Great question, and I'll get into that in a little bit. We have different revenue lines, and our price ranges go from 2k all the way to 10k+, depending on what you are looking for, so tell me a little bit more about (the XYZ role / what you have in mind / what you came in looking for) so I can give you the exact details..."

Price / Expensive

Seniority > Expectations — use when the objection is budget-specific.

Ask: "I hear you. Money aside, is there anything else coming up?" If budget-specific: "Let's adjust the scope, not the quality — we can hire slightly junior, or start you at a lower band and grow into it as the role proves out."

Price vs. Cost of Inaction

Agree: "I totally hear you." Answer: "Let me ask you this: what's more expensive for you: $5k or continuing to have [inaccurate data / no leads / low revenue / broken dashboards / staying behind everyone else on AI and getting outperformed by competitors]?" Reclose: "Given that — assuming we set this up, how soon would you want this person to start?"

Already Hired Offshore for Cheaper — a diagnostic opener, not a full sequence. The line's job is to surface what the real objection actually is; once it surfaces, run whichever AAAR fits it.

"If you got the results, why didn't you stick with them / why are you on this call?"

Offshore vs. American (they hired a similar profile) — same as above, a diagnostic opener.

"Cool, why don't you just keep working with them and why don't you have the results we were talking about yet?" If they were good — Answer: "How much did you guys pay this person? And was that before payroll tax, insurance, paid time off, and benefits?" ... "Because the hire we would find you would just come in at $X rate, without any other add-ons whatsoever, so you still are saving all of the above."

Offshore vs. American (think they can find US hires for that cost)

Agree: "Totally fair to want the math to work." Ask: "But money aside — assuming this was free — would you explore this option?" Answer: "Great. We kind of touched on the range for this role in the US — (what was the number?) $X–$Y/year in salary alone? Obviously before payroll tax, benefits, or insurance, etc. Right? (Don't pause) Comparing that against the $4–5K/month for a 1:1 equivalent without any other add-ons seems like a no-brainer, no? You would STILL end up saving XYZ." Reclose: "But if we were to kick this off, would you need our team's help figuring out what the take-home assessment should look like / When would you want this person to start?" Alt: "Are you 100% sure the American will guarantee you the results."

Nearshore Competitors Are Cheaper

Agree: "I hear you completely. How much did you say your [ad spend budget] was? $150k/mo / You mentioned this person will be auditing all departments to automate all the redundancies, right? / You mentioned this person needs to own the brand, etc." Answer: "Would you actually want the cheapest [role name] anywhere near your [ad spend]? The $4–5K isn't for someone who would just fill the seat. This hire is poached specifically for you — built around your exact JD, screened against your bar, and has done this before. Cheaper hires usually mean recycled, generic candidates who were sitting around, hoping the agency finally matches them with a client. What that means for you: in 2 months, you'll figure out they're underperforming, fire them, and start looking for a more qualified replacement. Which is more time spent NOT [hitting XYZ biz outcomes stated]." Reclose: "That said, are we good moving forward at this scope, or is there something specific about the JD you'd want to adjust before we start?"

Windowshopping / DIY (price framing)

"You're about to make a $50k commitment (their ~NTC×12) — according to your budget — is paying $299 to see a wider pool of candidates actually not worth the investment you're about to commit to?"

Need to Think About It — two touches, escalating.

Touch 1 (first pass — treat as a smokescreen): Agree: "No, I get it." Ask: "While you do that, let me pull up the form to see if we have availability…” Reclose: “Assuming we set this up, would it be easier to communicate via email or slack?”
Touch 2 (once it's confirmed real, not a smokescreen): Agree: "Cool." Ask: "What do you need to think about…? We're still here haha." Answer: [address the actual 1–2 things, with facts, not pressure] Reclose: "I mean, we still have 15 minutes to our call, let me show you this very quickly."

Not Ready to Commit

Agree: "Fair — we've been talking [X] minutes; I wouldn't expect you to be ready yet." Ask: "What are the 1–2 parts of the process you're still fuzzy on?" Answer: [address specifically] "…these two aside — if we were to fix those, I assume you would be ready to move forward." Reclose: "Then let's make it easy — I'll get you started today and personally brief your Delivery Manager on the scope so week one moves fast."

Stakeholder Involvement — Peel the Onion Before Handling

"I need to talk to my team / partner / Finance" is not a diagnosis. It is a process signal. The AE must determine whether the other person is an approver, scope contributor, payment administrator, or merely advisory. Do not collapse these into one objection.

Step 1 — Approval first. Ask:

"Is that permission or support?"

A. YES — someone else must approve / can veto

This is an Authority FAIL per the Tool 1 test — don't keep trying to prove the prospect secretly has authority. Determine instead whether the person on the call is actually a champion.

Peel in this order:

Who approves? — "Who specifically needs to approve it?"
What do they need? — "What do they usually need to see or believe to approve something like this?"
Close the person in front of you: — "Assuming they approve it, are you personally comfortable moving forward with us?"
Anticipate the approver: — "What do you think their biggest question or concern is going to be?"
Get access / timing: — "When can you two actually connect on it?" / "What's the easiest way to get them comfortable — should we get them on together?"

Champion standard: Per the champion definition in SQL Authority (Tool 1) — the personal yes only counts once it's actually given, and a clean champion close still doesn't convert Authority to PASS for SQL. What Category 6 grades on top of that: a non-decision-maker who never gives that personal yes is not yet a champion — there's still an unresolved objection sitting with the person on the call, and the AE should keep working it rather than treating a vague "sounds good" as a close.

B. NO — nobody else's approval is required

Authority = PASS. If the prospect still mentions another person or team, diagnose why they want them involved instead of surrendering the close. Ask:

"Do you need their input before the role itself is final, or do you just want their opinion / to keep them in the loop?"

Then branch:

Advisory / FYI only — they want another opinion, want to pressure-test the choice, or want to keep someone informed — but that person cannot veto the purchase and is not needed to finish the scope. Authority = PASS. Scope can still be decision-ready. Push for the actual decision / deposit. Useful isolation: "If they don't raise anything you haven't already considered, you're comfortable moving forward?"
Scope input needed — Authority remains separate. Run the material-vs-minor scope test from the SQL Authority rule above — same four-question script, same classification, don't re-derive it here. What Category 6 grades on top of that: did the AE actually run the test instead of accepting "I need my team's input" as a stall? And if it came back material, did they reclose — confirm what's locked, name what's open, and book the specialist follow-up before hanging up — rather than letting the call end in "I'll send you the deck"? Material scope uncertainty is not an Authority failure unless one of those stakeholders also has approval/veto rights.

C. Finance / procurement is mentioned

Don't infer Authority from the word "Finance" — run the same processing-vs-veto distinction from Tool 1's Authority table. Ask:

"When you say Finance has to approve it, do they actually decide whether the company spends the money, or once you've approved the hire are they just processing / releasing the payment?"

Processing only → Authority PASS (per Tool 1) — close normally and lock the payment handoff.
Can reject / must approve the spend → Authority FAIL (per Tool 1) — run the approval path above: personal yes → approval criteria → likely concern → access/timing.

Scoring principle: The rep is not rewarded for "overcoming" a real approval constraint. The skill is in removing ambiguity, separating approval from input, closing the person in front of them at the level they actually control, and creating a concrete path to the next decision. The failure is accepting "I need to talk to someone" without determining what that person actually controls.

Not the Right Time / Timing

Mirror: Repeat the last 3–5 words, then stop talking. Let the silence pull out the real reason. Loop to Cost of Inaction (if still vague, and duration was established earlier in the call): Ask: "If you'd filled this role 6 months ago — where would the business be right now? Would we even be on this call?" Answer: [let them answer, reinforce whatever gap they name] Reclose: "So the real question isn't whether now's perfect — it's whether waiting another month makes it any better. Does it?"

If this resolves into "I'm just not ready" rather than a timing-specific stall, switch to the Not Ready to Commit script above. If it's still vague after that, run Direct Diagnostic.

Late-call closing option (use once, near the end, when price and proof are the last thing in the way — not tied to a specific earlier step):

"We've been talking for 45 mins, here are case studies that prove this process works. We have over 100 clients paying us every month. And if you still don't believe me, the only thing at stake is that $299 deposit that we will TOTALLY refund if we do such a horrible job at finding you qualified [Role], which I know we will crush anyway. So, if we were to set this up, would you wanna meet today or tomorrow?"

Can You Follow Up With Me

Ask: "Happy to — so I follow up on the right thing, what are the two things that would need to be true for you to move forward today?"

DIY (Doing It Themselves)

Time Savings Angle

Agree: "You could — you clearly know how to run a hiring process." Ask: "Out of curiosity — how many hours did the last search like this take you, start to finish?" Answer: [they name a number] "So it's not really 'can you do it' — it's 'is this the highest use of your time right now.' We run the 600+ applicant funnel, the screening, the vetting — you review a shortlist. That's [X hours] back on your calendar for the parts of the business only you can do." Reclose: "So the real question — is running this search yourself the best use of your next two weeks, or is getting it off your plate worth $299 to you?"

Windowshopping / DIY — same line as the Price/Expensive version above, used in both contexts on purpose:

"You're about to make a $50k commitment (their ~NTC×12) — according to your budget — is paying $299 to see a wider pool of candidates actually not worth the investment you're about to commit to?"

Margins — two touches, only answer the number on the second push.

Touch 1 (deflect — don't answer the percentage): "Great question — but what actually matters is that the number I gave you is fully all-in: no additional fees, no surprise costs down the line. That's what you're comparing it against."
Touch 2 (only if they push back again, still wanting the number): "It really ranges anywhere between 30–35% based on how hard it was to source the candidate, and obviously based on skill set, experience, and role expectations, and most importantly, how much the candidate said they wanna get paid, etc."

Incomplete objection sequences: If the transcript or recording ends mid-objection, do not score it as "accepted immediately" by default. Mark it "Unresolved — insufficient data" and note only what was actually visible. A missing ending is not the same finding as a rep who folded.

For each genuine objection, note:

What the objection was
What the rep did: Direct Diagnostic attempted / specific script attempted / AAAR attempted / accepted immediately
Rating: Solid or Room for Improvement, one-line reason

Scoring:

10–12: Every vague objection is isolated; every named objection gets the right specific framework; stakeholder/process statements are correctly diagnosed into approval vs. advisory vs. Finance administration vs. scope input; real constraints are accepted only after they are verified, and the rep then closes the strongest commitment available.
6–9: Right move attempted on most objections, but one objection or stakeholder path is incompletely diagnosed or weakly reclosed.
0–5: Rep accepts ambiguity on the first pass with no attempt to isolate it — e.g. "Totally fair, I'll send you the deck" after "I need to talk to my team" — or repeatedly treats real approval/scope constraints as if pressure alone can erase them. Margin percentage given away on the first ask.


Category 7: Scope & Role Qualification — /10
What it measures: Did the rep ask the right questions to properly define the role, catch and challenge scope creep, determine whether the role is decision-ready, and confirm both role scope and budget range before the call ended? Budget acknowledgment for the scoped role is scored here — not in Category 5. Authority and decision readiness are separate: a prospect can have full Authority while still needing material stakeholder input before the role itself is final.

The required scoping questions — all 11 must be asked on any call where a hire is being discussed, except the license/certification question, which only applies when the role is Finance or Tech. Don't dock a call for skipping a question that has nothing to do with the role being scoped:

Question
Why It Matters
Walk me through the responsibilities — what does this person own day-to-day?
Surfaces scope creep. One person can't own 6 functions.
What specific skills are non-negotiable vs. nice to have?
Separates must-haves from wish lists.
What seniority level are you looking at? How many years of experience?
Prevents under- or over-scoping. Determines price range.
What background is required — industry, tech stack?
Shapes the JD and candidate pool.
Any specific license/certification they need to have? (Finance/Tech roles only — not required outside these functions)
Some roles are legally or technically non-negotiable on credentials.
Will they follow an existing process, or build one from scratch?
Changes the seniority and self-direction bar for the search.
Will this person be managing anyone now or in the next 6 months?
Changes seniority requirement and salary range.
What level of English is required — conversational / native-level?
Critical for candidate sourcing. Affects price.
Is this person reporting to you or someone else on the team?
Confirms the reporting line and who owns the relationship post-placement.
Will they work with any internal team members or vendors?
Surfaces integration points and delivery dependencies.
How soon do you wanna onboard someone for this role?
Sets urgency and search timeline expectations.


Rep-elicited vs. surfaced: Same standard as Category 3. A required scoping element the prospect volunteers unprompted still counts if the rep catches it, confirms it back, or builds on it. Tag it "(surfaced, not built on)" only if the rep lets it pass without acknowledging or using it — that case doesn't credit toward the required-questions count.

Budget acknowledgment standard: The rep must confirm a salary range for the specific role being scoped — and the client must acknowledge it — before the call ends. This is not optional and not the same as delivering the deposit price.

What's acceptable:

"For this type of hire — [seniority + responsibilities described] — you're typically looking at $[X]–$[Y]/month all-in."

Role confirmation before close: Before the call ends, the rep must verbally confirm back the role as scoped:

"So just to confirm before we wrap — we're kicking off a search for [role], [seniority], [key responsibilities], [English level], [location preference if any]."

This locks both parties to the same understanding before money changes hands or a follow-up is booked.

Decision-readiness / stakeholder-input test: If the prospect says another person or team needs to weigh in on the role, apply the material-vs-minor scope test from SQL Authority (Tool 1) — same four-question script, same classification, don't re-derive it here.

What Category 7 specifically grades: if the input is minor, did the AE avoid using it as a reason to stall the close? If it's material, did the AE execute the full lock — recap the scope that is known, name the unresolved elements explicitly, state whether the budget range is firm or provisional, and book the stakeholder/specialist follow-up with a clear agenda — instead of faking a final role confirmation?

This is a Scope/Decision-Readiness issue, not an Authority failure unless that stakeholder also has approval or veto rights.

Scoring:

8–10: All applicable required questions covered on the call — 11 if the role is Finance or Tech, 10 otherwise, since the license/certification question doesn't apply outside those functions (asked by the AE, or by a secondary participant and tagged "(not the AE — [Name])" — either way the requirement is met). Anything the prospect volunteered was caught and built on, not left as "surfaced, not built on." Scope creep caught and challenged where present. Budget range for the role confirmed and acknowledged by client. If the scope is decision-ready, role and range are confirmed back together before the call ends. If a genuine material scope-input gap remains, the AE instead cleanly recaps known scope + unresolved items + budget status and locks the stakeholder follow-up; that can still score 9–10 because it is the correct path. One isolated gap — a single fully-missing applicable question, a missed budget acknowledgment when a reliable range was available, or a required recap miss — caps this at 8.
5–7: One or two applicable required questions are missing or left surfaced-not-built-on, scope creep was only partially challenged, budget/range status was not made clear, or the AE recognized a material scope gap but left the stakeholder path loose.
0–4: Three or more applicable required questions missing or reduced to surfaced-not-built-on, scope creep accepted without pushback, material scope uncertainty ignored, or no usable budget/range position was established — the scoping is thin across the board, not an isolated miss.


Category 8: Energy & Tonality — /5
Scored from transcript only for now. Vocal register, inflection, and pacing require audio and aren't assessed here — this category currently covers only the energy failures visible in word choice.

What it measures: Whether the rep escalates, redirects, and reads signals correctly at the right moments, based on what they actually said.

The three energy failures to watch for:

Validating non-urgency. Prospect says "not right now" and rep says "totally fair" — then moves on.
Wrong: "You're doing the correct stuff." / "That makes sense." / "Totally fair."
Right: "What would need to be true for the timing to feel right?"
Matching wind-down energy. When the prospect starts signaling goodbye, rep mirrors it instead of redirecting.
Missing the gear change. A buying signal lands, a pain signal surfaces in small talk, or a competitive threat is disclosed — and the rep doesn't register it.

Buying signals that require immediate escalation:

Escalation means close the strongest commitment the prospect actually controls — final deal if Authority + scope are ready, conditional personal yes if an approver exists, or a concrete scope-resolution commitment if material role input remains.

"It seems like a formidable solution" → "What would make it sooner?"
"I could see using this later this year" → "What needs to happen first?"
"Get me a good deal and I'll be motivated" → connect to the offer immediately
"It seems like an easy way to get started" → close the highest available commitment now
"I'm inclined to say yeah" → close the highest available commitment now; if Authority FAILS, secure the champion's personal yes + approver next step instead of letting the call wind down

Pain signals buried in small talk:

"My brain is fried from nine months of going hard" → "What's still not solved that you need to fix before you can rest?"
"We've been burning money on a bad agency" → "What's that costing you at this point?"

Rep-level pattern flag: If the same energy failure appears multiple times on one call, or across calls from the same rep, flag it as a habit. Confirm each instance is genuinely the same failure before calling it a pattern — a pain-disclosure moment mislabeled as a timing objection does not count as a second occurrence.

Scoring:

4–5: Never validates non-urgency. Escalates at every buying and pain signal. Redirects instead of matching wind-down energy.
2–3: One miss among these — one non-urgency validation, one missed signal, or one wind-down mirror — otherwise controlled.
0–1: Validates non-urgency, matches wind-down energy, or misses buying/pain signals as a repeated pattern across the call.


Scoring Pitfalls — Quick Reference
Fast checks before you finalize a score. Everything here restates a rule already covered above — use this to catch yourself, not to look up anything new.

Don't double-penalize the same behavior across categories. Check the category ownership table first. If discovery was thin, deduct in Category 3 — not also in Category 1 for the same absence.
Objection handling — don't credit a response that didn't attempt resolution. "I hear you on that" with no Direct Diagnostic or AAAR = Room for Improvement at best. "That's okay" plus a vague follow-up = 0 on that objection. Check whether the rep ran the formula, not just whether they said something sympathetic.
Objection handling vs. Energy — one line of transcript can support two findings; don't turn it into two coaching points. "Totally fair" on a timing objection is both a failed Direct Diagnostic (Category 6) and a validated non-urgency instance (Category 8) — score both categories on their own terms, but when you write the single coaching point for the post-mortem, treat it as one habit to fix, not two.
Budget — don't mark Category 5 down for the client not acknowledging salary range. That's Category 7's job. Category 5 scores delivery mechanics only.
Scope — don't dock the license/certification question outside Finance/Tech roles. It's conditionally required, not universal — see Category 7.
Scope creep — score it in Category 7, not Category 3. Category 3 scores the quality of pain questions. Category 7 scores whether the role was properly defined and scope was challenged.
CTA — don't reward vague follow-ups. A specific date on the calendar before hanging up = Met. "I'll send you the deck," "reach out when ready," "you have my contact info" = Not Met.
EOR vs. AOR — flag it every time. Any rep who says "employer of record" gets an explicit flag in coaching notes. Not a minor slip.
SQL — don't auto-qualify based on enthusiasm. "This sounds great" with no active role, no confirmed timeline, no confirmed decision maker = not SQL.
SQL — a real disqualifier isn't automatically a rep failure. Authority FAIL or a stated beyond-30-day timeline are still hard SQL = No triggers regardless of how well the AE handled them. Note it as a qualification outcome, then grade the AE's handling of it separately in Category 6.
Discovery — product and admin questions don't count. Clarifying questions, feature preference, and logistics don't count toward Category 3. Only probe, provoke, bridge, and shutting-doors questions count.
Rapport — warmth alone is not full credit. A warm call that stays warm without converting = 3–4, not 5–6.