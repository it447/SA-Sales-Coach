import type { RoleScope, PricingDataRow } from "./types";

export interface MarginResult {
  marginPct: number | null;
  dealWorthIt: boolean | null;
  finalPrice: number | null;
}

export type CommissionTierName =
  | "Hero"
  | "Safe-Strong"
  | "Safe-Solid"
  | "Acceptable"
  | "Below Standard";

/**
 * Commission tier thresholds, lifted verbatim from the legacy
 * scale-army-pricing-calculator app (getCommissionTier in its app/page.js).
 * margin = (price - salary) / price, spread = price - salary.
 */
export function getCommissionTier(margin: number, spread: number): CommissionTierName {
  if (margin >= 0.5 || (margin >= 0.4 && spread >= 1000)) return "Hero";
  if (margin >= 0.35 && spread >= 1000) return "Safe-Strong";
  if (margin >= 0.4 && spread >= 600) return "Safe-Solid";
  if (margin >= 0.35) return "Acceptable";
  return "Below Standard";
}

/**
 * Finds the pricing_data row for a scoped role.
 *
 * ASSUMPTION (flag if wrong): matches on title + seniority only, case
 * insensitive. RoleScope has no region field (per the original data model),
 * so when a title+seniority pair exists in both Africa and LATAM, this picks
 * the cheaper (lower salary) row as the conservative default. If reps need
 * to pick a region explicitly during the call, that'll need a region field
 * added to RoleScope — flag if so.
 */
function matchPricingRow(role: RoleScope, pricingData: PricingDataRow[]): PricingDataRow | null {
  if (!role.title || !role.seniority) return null;

  const candidates = pricingData.filter(
    (row) =>
      row.role.toLowerCase() === role.title!.toLowerCase() &&
      row.seniority.toLowerCase() === role.seniority!.toLowerCase()
  );

  if (candidates.length === 0) return null;
  return candidates.reduce((cheapest, row) => (row.salary < cheapest.salary ? row : cheapest));
}

/**
 * Computes the deal's margin/price/worth-it verdict from the current roles.
 *
 * Formula source: scale-army-pricing-calculator's AEGuidance/PricingDealHealthTab
 * (margin = (price - salary) / price) and the scale-army-jd-tool's financial
 * review step (client-budget-vs-salary viability check). `finalPrice` here is
 * the RECOMMENDED price (sum of each matched role's targetPrice from
 * pricing_data) — not a client-negotiated number. The rep still explicitly
 * locks in whatever price was actually agreed via /lock-price; this route
 * just tells them what a healthy price looks like.
 *
 * Returns nulls if any role isn't scoped enough yet to price (missing
 * title/seniority, or no matching pricing_data row) — the caller should
 * treat that as "not ready to quote."
 */
export function calculateMargin(
  roles: RoleScope[],
  pricingData: PricingDataRow[]
): MarginResult {
  if (roles.length === 0) {
    return { marginPct: null, dealWorthIt: null, finalPrice: null };
  }

  const matches = roles.map((role) => matchPricingRow(role, pricingData));
  if (matches.some((match) => match === null)) {
    return { marginPct: null, dealWorthIt: null, finalPrice: null };
  }
  const matchedRows = matches as PricingDataRow[];

  const totalSalary = matchedRows.reduce((sum, row) => sum + row.salary, 0);
  const finalPrice = matchedRows.reduce((sum, row) => sum + row.targetPrice, 0);

  if (finalPrice <= 0) {
    return { marginPct: null, dealWorthIt: null, finalPrice: null };
  }

  const spread = finalPrice - totalSalary;
  const marginPct = spread / finalPrice;
  const tier = getCommissionTier(marginPct, spread);
  const meetsFloor = matchedRows.every((row) => marginPct >= row.minMargin);

  return {
    marginPct,
    dealWorthIt: tier !== "Below Standard" && meetsFloor,
    finalPrice,
  };
}
