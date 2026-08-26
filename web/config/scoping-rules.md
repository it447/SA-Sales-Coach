# Role-scoping conventions

This file is injected into the Claude system prompt for `/api/sessions/:id/extract`
(see `web/app/api/sessions/[id]/extract/route.ts`, once built in Phase 2).

It is intentionally empty of real content right now — fill in our actual
conventions and Claude will start using them on the next deploy. No code
changes needed.

## What counts as a separate role vs. one role with variants

_(TODO: e.g. "Different seniority levels for the same title = one role with a
seniority range, not two roles. Different titles = always separate roles.")_

## Required fields before a role is considered "scoped"

- `title`, `seniority`, and `region` are required.
- `region` must be explicitly `"Africa"`, `"LATAM"`, or `"Both"` — only set
  `"Both"` when the client has actually said region doesn't matter to them.
  Don't default to `"Both"` just because it wasn't mentioned; if the
  transcript hasn't addressed region yet, leave it `null` and flag
  `missing_field` so the rep asks.

_(TODO: add any additional required fields, e.g. minimum must-have skill count.)_

## Objection-handling playbook

Generic placeholder — replace with our real playbook once we have one.
Claude should still surface a suggestion whenever it hears pushback
language, using this as a fallback tone/structure guide in the meantime.

- **Price objection** ("that's too expensive", "over budget"): acknowledge
  the concern, reframe on value/outcome rather than discounting
  immediately, and offer to walk through what's included before touching
  the number.
- **Competitor objection** ("we already use X", "we're happy with our
  current provider"): ask what's working and what isn't with the current
  solution before pitching against it — don't attack the competitor by
  name.
- **Timeline pushback** ("we need to think about it", "let's revisit next
  quarter"): identify the specific blocker (budget approval, internal
  buy-in, etc.) rather than accepting a vague delay, and propose a concrete
  next step with a date.
- **General rule**: never suggest a specific discount or price change as an
  objection response — that's the rep's call, not something to auto-suggest.

_(TODO: replace with our actual standard responses once we have them.)_

## Budget mismatch signals

Whenever the client states a specific number (or range) for what they'd
pay for a role, set that role's `clientBudget` to it — this is what
computes "margin at their number" for the rep, not just our recommended
price. If they give a range ("$3k to $4k"), use the TOP of the range: the
tool should evaluate against what they said they'd go up to, not the
low end. Leave `clientBudget` null until they've actually given a number —
don't guess one from context.

Reference thresholds pulled from the legacy `scale-army-jd-tool` agent's
financial review step (same underlying formula as `web/lib/pricing.ts`):
margin = (client_budget - salary) / client_budget.

- Flag `budget_mismatch` if the client's stated budget is below the matched
  pricing_data row's `salary` outright (budget doesn't even cover cost).
- Flag `budget_mismatch` if margin at the client's budget would be below
  0.22 (absolute floor) or below the matched row's `minMargin` (role-specific
  floor) — whichever is higher.
- Flag `budget_mismatch` (as a "too high" variant) if margin at the client's
  budget would exceed 0.50 — worth a gut-check with the client rather than
  quietly taking the win.

_(TODO: confirm these thresholds are still current — they're carried over
from the old tools, not re-confirmed for this one.)_
