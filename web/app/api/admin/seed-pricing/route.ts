import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { pool } from "../../../../lib/db";

/**
 * One-time setup endpoint: applies db/seed-pricing.sql (our role/salary/
 * margin dataset, generated from the legacy pricing calculator's
 * policies.json) to whatever database POSTGRES_URL points at. Same
 * browser-clickable pattern as /api/admin/migrate — hit with
 * ?key=<INTERNAL_API_KEY>.
 *
 * Safe to run more than once: seed-pricing.sql upserts on id conflict
 * rather than erroring or duplicating rows.
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
    const seedPath = path.join(process.cwd(), "db", "seed-pricing.sql");
    const seed = readFileSync(seedPath, "utf8");
    await pool.query(seed);
    const count = await pool.query("select count(*)::int as count from pricing_data");
    return NextResponse.json({
      ok: true,
      message: "Pricing data seeded successfully.",
      rowCount: count.rows[0].count,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
