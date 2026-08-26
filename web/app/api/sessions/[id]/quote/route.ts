import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";
import { calculateMargin, calculateUsaSavings } from "../../../../../lib/pricing";
import type { PricingDataRow, UsaBenchmarkRow } from "../../../../../lib/types";

interface PricingDataDbRow {
  id: string;
  pod: string;
  role: string;
  family: string;
  seniority: string;
  region: string;
  salary: string;
  gm_floor: string;
  target_price: string;
  min_margin: string;
  skills: unknown;
}

function dbRowToPricingData(row: PricingDataDbRow): PricingDataRow {
  return {
    id: row.id,
    pod: row.pod,
    role: row.role,
    family: row.family,
    seniority: row.seniority,
    region: row.region,
    salary: Number(row.salary),
    gmFloor: Number(row.gm_floor),
    targetPrice: Number(row.target_price),
    minMargin: Number(row.min_margin),
    skills: row.skills as string[],
  };
}

interface UsaBenchmarkDbRow {
  id: string;
  role: string;
  category: string;
  seniority: string;
  salary: string;
}

function dbRowToUsaBenchmark(row: UsaBenchmarkDbRow): UsaBenchmarkRow {
  return {
    id: row.id,
    role: row.role,
    category: row.category,
    seniority: row.seniority,
    salary: Number(row.salary),
  };
}

/**
 * POST /api/sessions/:id/quote — runs the margin calculation against the
 * current roles. Does NOT set quote.lockedAt — that only happens when the
 * rep explicitly confirms via /lock-price.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  try {
    const [pricingRows, usaBenchmarkRows] = await Promise.all([
      pool.query<PricingDataDbRow>("select * from pricing_data"),
      pool.query<UsaBenchmarkDbRow>("select * from usa_benchmark_data"),
    ]);
    const pricingData = pricingRows.rows.map(dbRowToPricingData);
    const usaBenchmarkData = usaBenchmarkRows.rows.map(dbRowToUsaBenchmark);

    const { marginPct, dealWorthIt, finalPrice, tier, recommendations } = calculateMargin(
      session.roles,
      pricingData
    );
    const { usaSalary, monthlySavings, annualSavings } = calculateUsaSavings(
      session.roles,
      finalPrice,
      usaBenchmarkData
    );

    const newQuote = {
      marginPct,
      dealWorthIt,
      finalPrice,
      tier,
      recommendations,
      usaSalary,
      monthlySavings,
      annualSavings,
      lockedAt: session.quote.lockedAt,
    };

    const result = await pool.query(
      "update call_sessions set quote = $1::jsonb where id = $2 returning *",
      [JSON.stringify(newQuote), params.id]
    );

    return NextResponse.json(rowToSession(result.rows[0]));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
