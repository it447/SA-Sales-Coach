// Applies db/seed-pricing.sql (our role/salary/margin dataset) to
// POSTGRES_URL/DATABASE_URL. Safe to re-run — it upserts on id conflict.
//
// Usage:
//   POSTGRES_URL=postgres://... node db/seed-pricing.mjs
// or, from the repo root:
//   npm run db:seed-pricing --workspace web

import { fileURLToPath } from "node:url";
import path from "node:path";
import { runSqlFile } from "./run-sql-file.mjs";

await runSqlFile(path.dirname(fileURLToPath(import.meta.url)), "seed-pricing.sql");
