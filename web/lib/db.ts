/**
 * Thin Postgres connection wrapper.
 *
 * We use plain `pg` (not @vercel/postgres) so this works unmodified whether
 * the database is Vercel Postgres or Supabase — both just hand you a
 * standard Postgres connection string.
 *
 * Set POSTGRES_URL (or DATABASE_URL) in the environment. Vercel Postgres and
 * Supabase both name theirs differently depending on how you connect it, so
 * we accept either.
 */
import { Pool } from "pg";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  // Thrown at request time, not import time, so `next build` doesn't need env vars set.
  console.warn(
    "POSTGRES_URL/DATABASE_URL is not set. Database calls will fail until it is configured."
  );
}

// A module-level singleton pool, reused across serverless invocations in the
// same warm lambda instance.
export const pool = new Pool({
  connectionString,
  ssl: connectionString?.includes("localhost") ? false : { rejectUnauthorized: false },
});

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}
