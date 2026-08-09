# Deal Assistant (SA-Sales-Coach)

An internal Chrome extension that joins our sales team's Google Meet calls
and coaches reps live: scoping roles, catching scope creep, calculating
margin, suggesting objection handling, and generating job descriptions once
a deal is priced. In-house replacement for paid tools like Gong/Woz —
internal use only, no external end users. Payment/invoicing is out of scope
for this tool and happens elsewhere .

## Repo layout

This is a monorepo with two workspaces:

- **`/extension`** — the Chrome extension (Manifest V3). Runs on
  `meet.google.com`, reads live captions, and renders the coaching sidebar.
  Talks only to `/web`'s API — it has no direct database or LLM access.
- **`/web`** — the backend, a Next.js app deployed to Vercel. Holds the
  database and calls the Anthropic API. See `web/lib/types.ts` for the core
  `CallSession` data model and `web/db/schema.sql` for the Postgres schema.

## Running locally

### Backend (`/web`)

```bash
cd web
cp .env.example .env.local   # fill in POSTGRES_URL, ANTHROPIC_API_KEY, INTERNAL_API_KEY
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

## API routes (Phase 2)

All under `web/app/api/sessions`, auth'd via `Authorization: Bearer <INTERNAL_API_KEY>`:

- `POST /api/sessions` — create a session (`{ meetLink, repEmail }`)
- `GET /api/sessions/:id` — full session state (polled by the extension)
- `POST /api/sessions/:id/transcript` — append transcript chunks (`{ chunks: TranscriptChunk[] }`)
- `POST /api/sessions/:id/extract` — runs Claude over the transcript, updates `roles`/`scopeFlags`, returns live `objectionSuggestions` (not persisted)
- `POST /api/sessions/:id/quote` — runs `calculateMargin()` against `pricing_data`, updates `quote` (never sets `lockedAt`)
- `POST /api/sessions/:id/lock-price` — rep-triggered, sets `quote.lockedAt` and status `priced`
- `POST /api/sessions/:id/generate-jds` — only if `quote.lockedAt` is set; drafts a JD per role via Claude using `web/config/jd-template.md`, sets status `jd_ready`

## Status

Phase 0 (repo scaffolding), Phase 1 (data model), and Phase 2 (API routes)
are done. Phase 3 (extension UI) and Phase 4 (dashboard/polish) are next.
