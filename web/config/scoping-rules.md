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

_(TODO: e.g. "If client states a budget below our minMargin floor for the
matched pricing_data row, flag budget_mismatch.")_
