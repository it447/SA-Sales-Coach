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

_(TODO: e.g. "title, seniority, region, and at least 2 must-have skills.")_

## Objection-handling playbook

_(TODO: paste our standard responses to price objections, "we already use X"
competitor objections, timeline pushback, etc. Claude will surface the
relevant one based on transcript language.)_

## Budget mismatch signals

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
