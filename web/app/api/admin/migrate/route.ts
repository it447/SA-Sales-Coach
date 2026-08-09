import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { pool } from "../../../../lib/db";

/**
 * One-time setup endpoint: applies db/schema.sql to whatever database
 * POSTGRES_URL points at. Meant to be hit once by hand from a browser
 * (via ?key=<INTERNAL_API_KEY>) when there's no easy terminal access to run
 * `npm run db:migrate` locally. Safe to run more than once — every
 * statement in schema.sql is `create ... if not exists` / `create or
 * replace`, so re-running it is a no-op if the schema is already applied.
 *
 * Not meant to stay in use long-term — once the team's comfortable running
 * migrations from a terminal, this can be removed.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const expected = process.env.INTERNAL_API_KEY;

  if (!expected) {
    return NextResponse.json(
      { error: "INTERNAL_API_KEY is not set in the environment." },
      { status: 500 }
    );
  }

  if (key !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const schemaPath = path.join(process.cwd(), "db", "schema.sql");
    const schema = readFileSync(schemaPath, "utf8");
    await pool.query(schema);
    return NextResponse.json({ ok: true, message: "Schema applied successfully." });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
