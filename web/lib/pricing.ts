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
 * Matches on title + seniority (case-insensitive), then narrows by region:
 * - role.region is "Africa" or "LATAM" -> only rows in that region.
 * - role.region is "Both" (client explicitly doesn't care) or null (not
 *   asked yet) -> any region, picking the cheaper (lower salary) row as the
 *   conservative default.
 */
function matchPricingRow(role: RoleScope, pricingData: PricingDataRow[]): PricingDataRow | null {
  if (!role.title || !role.seniority) return null;

  let candidates = pricingData.filter(
    (row) =>
      row.role.toLowerCase() === role.title!.toLowerCase() &&
      row.seniority.toLowerCase() === role.seniority!.toLowerCase()
  );

  if (role.region && role.region !== "Both") {
    candidates = candidates.filter((row) => row.region.toLowerCase() === role.region!.toLowerCase());
  }

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
 * treat that as "not ready to quote." Region isn't required here (falls
 * back to the cheaper region if unset) even though it's still a required
 * field for a role to count as fully "scoped" — see scoping-rules.md.
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
