// Shared runner used by db/migrate.mjs and db/seed-pricing.mjs.
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

export async function runSqlFile(dir, filename) {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Set POSTGRES_URL or DATABASE_URL before running this.");
    process.exit(1);
  }

  const sql = readFileSync(path.join(dir, filename), "utf8");
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    await client.query(sql);
    console.log(`${filename} applied successfully.`);
  } catch (err) {
    console.error(`Failed to apply ${filename}:`, err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
