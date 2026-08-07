// Applies db/schema.sql to whatever Postgres instance POSTGRES_URL/DATABASE_URL
// points at (Vercel Postgres or Supabase both work — they're plain Postgres).
//
// Usage:
//   POSTGRES_URL=postgres://... node db/migrate.mjs
// or, from the repo root:
//   npm run db:migrate --workspace web

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set POSTGRES_URL or DATABASE_URL before running the migration.");
  process.exit(1);
}

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "schema.sql"
);
const schema = readFileSync(schemaPath, "utf8");

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(schema);
  console.log("Schema applied successfully.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
