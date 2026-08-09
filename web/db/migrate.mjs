// Applies db/schema.sql to whatever Postgres instance POSTGRES_URL/DATABASE_URL
// points at (Vercel Postgres or Supabase both work — they're plain Postgres).
//
// Usage:
//   POSTGRES_URL=postgres://... node db/migrate.mjs
// or, from the repo root:
//   npm run db:migrate --workspace web

import { fileURLToPath } from "node:url";
import path from "node:path";
import { runSqlFile } from "./run-sql-file.mjs";

await runSqlFile(path.dirname(fileURLToPath(import.meta.url)), "schema.sql");
