import { pool } from "./db";
import { rowToSession } from "./sessions";
import { calculateMargin, calculateUsaSavings } from "./pricing";
import { suggestPricingTitleMatch } from "./anthropic";
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
 * Suggests a real catalog title for each unpriced role that has enough info
 * to try (a title + seniority, just no exact match) — one Claude call per
 * such role. Only called with suggestMatches: true (see runQuote below),
 * i.e. only from a manual "Calculate Price" click, never the live-call
 * ingest loop, so this never adds to per-tick extraction cost.
 */
async function addSuggestedMatches(
  unpricedRoles: { roleId: string; roleTitle: string | null; reason: string; suggestedMatch?: string | null }[],
  roles: CallSession["roles"],
  pricingData: PricingDataRow[]
): Promise<typeof unpricedRoles> {
  return Promise.all(
    unpricedRoles.map(async (unpriced) => {
      const role = roles.find((r) => r.id === unpriced.roleId);
      if (!role?.title || !role.seniority) return unpriced;

      const candidateTitles = [
        ...new Set(
          pricingData
            .filter((row) => row.seniority.toLowerCase() === role.seniority!.toLowerCase())
            .map((row) => row.role)
        ),
      ];
      const suggestedMatch = await suggestPricingTitleMatch(role.title, candidateTitles);
      return { ...unpriced, suggestedMatch };
    })
  );
}

/**
 * Runs the margin + USA-savings calculation against a session's current
 * roles and persists the result. Shared by /quote (standalone/manual
 * "force refresh") and /ingest (transcript + extract + quote in one
 * request, for the extension's live-call loop) so the logic lives in
 * exactly one place. Does NOT set quote.lockedAt — that only happens when
 * the rep explicitly confirms via /lock-price.
 *
 * suggestMatches (default false): asks Claude to suggest a real catalog
 * title for each unpriced role (see addSuggestedMatches) — pass true ONLY
 * from a manual, rep-initiated quote calculation (see /quote/route.ts), not
 * from /ingest's automatic per-tick call, since each suggestion is an extra
 * Claude call and this must never scale with call duration.
 */
export async function runQuote(session: CallSession, suggestMatches = false): Promise<CallSession> {
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
    unpricedRoles: rawUnpricedRoles,
  } = calculateMargin(session.roles, pricingData);

  const unpricedRoles = suggestMatches
    ? await addSuggestedMatches(rawUnpricedRoles, session.roles, pricingData)
    : rawUnpricedRoles;
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
    unpricedRoles,
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
