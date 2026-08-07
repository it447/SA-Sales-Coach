# Deal Assistant (SA-Sales-Coach)

An internal Chrome extension that joins our sales team's Google Meet calls
and coaches reps live: scoping roles, catching scope creep, calculating
margin, suggesting objection handling, and generating deliverables (JDs,
payment links) once a deal is priced. In-house replacement for paid tools
like Gong/Woz — internal use only, no external end users.

## Repo layout

This is a monorepo with two workspaces:

- **`/extension`** — the Chrome extension (Manifest V3). Runs on
  `meet.google.com`, reads live captions, and renders the coaching sidebar.
  Talks only to `/web`'s API — it has no direct database or LLM access.
- **`/web`** — the backend, a Next.js app deployed to Vercel. Holds the
  database, calls the Anthropic API, and talks to Stripe. See
  `web/lib/types.ts` for the core `CallSession` data model and
  `web/db/schema.sql` for the Postgres schema.

## Running locally

### Backend (`/web`)

```bash
cd web
cp .env.example .env.local   # fill in POSTGRES_URL, ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, INTERNAL_API_KEY
npm install
npm run db:migrate           # applies db/schema.sql to your Postgres instance
npm run dev                  # http://localhost:3000
```

Database: default is [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
(Vercel dashboard -> Storage -> Create Database -> Postgres -> connect it to
this project). It auto-injects `POSTGRES_URL` into the project's env vars;
run `vercel env pull .env.local` to get it locally. [Supabase](https://supabase.com)
also works as a drop-in alternative — both are plain Postgres, so the app
only needs a standard connection string in `POSTGRES_URL`/`DATABASE_URL`.

### Extension (`/extension`)

```bash
cd extension
npm install
npm run build     # bundles src/ -> dist/ with esbuild
```

Then load it unpacked in Chrome:

1. Go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select the `extension/` folder

See `extension/README.md` for the day-to-day install doc reps will use once
the extension has real functionality (Phase 3+).

## CI

`.github/workflows/ci.yml` runs `npm run lint` and `npm run typecheck`
across both workspaces on every push and pull request.

## Status

Phase 0 (repo scaffolding) and Phase 1 (data model) are done. See
`web/lib/types.ts` and `web/db/schema.sql`. Phase 2 (API routes), Phase 3
(extension UI), and Phase 4 (dashboard/polish) are next.
