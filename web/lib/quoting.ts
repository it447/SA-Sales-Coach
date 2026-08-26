import { pool } from "./db";
import { rowToSession } from "./sessions";
import { calculateMargin, calculateUsaSavings } from "./pricing";
import type { CallSession, PricingDataRow, UsaBenchmarkRow } from "./types";

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
 * Runs the margin + USA-savings calculation against a session's current
 * roles and persists the result. Shared by /quote (standalone/manual
 * "force refresh") and /ingest (transcript + extract + quote in one
 * request, for the extension's live-call loop) so the logic lives in
 * exactly one place. Does NOT set quote.lockedAt — that only happens when
 * the rep explicitly confirms via /lock-price.
 */
export async function runQuote(session: CallSession): Promise<CallSession> {
  const [pricingRows, usaBenchmarkRows] = await Promise.all([
    pool.query<PricingDataDbRow>("select * from pricing_data"),
    pool.query<UsaBenchmarkDbRow>("select * from usa_benchmark_data"),
  ]);
  const pricingData = pricingRows.rows.map(dbRowToPricingData);
  const usaBenchmarkData = usaBenchmarkRows.rows.map(dbRowToUsaBenchmark);

  const {
    marginPct,
    dealWorthIt,
    finalPrice,
    tier,
    recommendations,
    pricedRoleCount,
    totalRoleCount,
    pricedRoles,
    priceTiers,
    atClientBudget,
  } = calculateMargin(session.roles, pricingData);
  // Uses pricedRoles (not session.roles) so savings stay apples-to-apples
  // with a partial quote — comparing USA cost for a role that isn't even
  // priced yet would be misleading.
  const { usaSalary, monthlySavings, annualSavings } = calculateUsaSavings(
    pricedRoles,
    finalPrice,
    usaBenchmarkData
  );

  const newQuote = {
    marginPct,
    dealWorthIt,
    finalPrice,
    tier,
    recommendations,
    priceTiers,
    atClientBudget,
    pricedRoleCount,
    totalRoleCount,
    usaSalary,
    monthlySavings,
    annualSavings,
    lockedAt: session.quote.lockedAt,
  };

  const result = await pool.query(
    "update call_sessions set quote = $1::jsonb where id = $2 returning *",
    [JSON.stringify(newQuote), session.id]
  );

  return rowToSession(result.rows[0]);
}
