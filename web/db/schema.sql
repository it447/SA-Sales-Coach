-- Deal Assistant core schema.
-- Works on Vercel Postgres and Supabase (both are plain Postgres).
-- Run with: npm run db:migrate --workspace web  (see web/db/migrate.mjs)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- call_sessions
--
-- One row per sales call. Most of the CallSession shape (see lib/types.ts)
-- is stored as jsonb because it's nested/variable-shaped (roles, flags,
-- quote, jds, transcript) and we always read/write it as one object from
-- the API layer anyway. status/meet_link/rep_email are broken out as real
-- columns because the dashboard (Phase 4) filters/sorts on them.
--
-- No payment tracking here — this tool ends at JD generation. Invoicing/
-- payment happens outside it.
-- ---------------------------------------------------------------------------
create table if not exists call_sessions (
  id           uuid primary key default gen_random_uuid(),
  meet_link    text not null,
  rep_email    text not null,
  status       text not null default 'scoping'
               check (status in ('scoping', 'scope_flagged', 'priced', 'jd_ready')),
  started_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  transcript   jsonb not null default '[]'::jsonb,
  roles        jsonb not null default '[]'::jsonb,
  scope_flags  jsonb not null default '[]'::jsonb,

  quote        jsonb not null default '{"marginPct": null, "dealWorthIt": null, "finalPrice": null, "tier": null, "recommendations": null, "usaSalary": null, "monthlySavings": null, "annualSavings": null, "lockedAt": null}'::jsonb,
  jds          jsonb not null default '[]'::jsonb
);

create index if not exists call_sessions_rep_email_idx on call_sessions (rep_email);
create index if not exists call_sessions_status_idx on call_sessions (status);

-- ---------------------------------------------------------------------------
-- Enforce the "only generate JDs after price is finalized" rule at the
-- database layer, not just in the API route. If any API code path forgets
-- the lockedAt check, the write fails loudly instead of silently corrupting
-- state.
-- ---------------------------------------------------------------------------
create or replace function enforce_lock_before_jds()
returns trigger as $$
begin
  if (new.jds is distinct from old.jds)
     and (new.quote ->> 'lockedAt') is null then
    raise exception 'Cannot write jds before quote.lockedAt is set (session %)', new.id;
  end if;

  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_lock_before_jds on call_sessions;
create trigger trg_enforce_lock_before_jds
  before update on call_sessions
  for each row
  execute function enforce_lock_before_jds();

-- ---------------------------------------------------------------------------
-- pricing_data
--
-- Our internal role/pricing dataset (salary, margin floor, target price per
-- role+seniority+region). This replaces the old scale-army-pricing-calculator
-- app's data/policies.json — same fields, now living in Postgres so both the
-- calculation route and the dashboard can query it directly.
-- ---------------------------------------------------------------------------
create table if not exists pricing_data (
  id           text primary key,
  pod          text not null,
  role         text not null,
  family       text not null,
  seniority    text not null,
  region       text not null,
  salary       numeric not null,
  gm_floor     numeric not null,
  target_price numeric not null,
  min_margin   numeric not null,
  skills       jsonb not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- usa_benchmark_data
--
-- Typical USA market salary per role/seniority, used to show the client how
-- much they'd save per month/year vs. hiring locally. A coarser, separate
-- role taxonomy than pricing_data (see db/seed-usa-benchmark.sql for why) --
-- extraction tags each scoped role with its closest match here.
-- ---------------------------------------------------------------------------
create table if not exists usa_benchmark_data (
  id        text primary key,
  role      text not null,
  category  text not null,
  seniority text not null,
  salary    numeric not null
);
