import type {
  RoleScope,
  PricingDataRow,
  UsaBenchmarkRow,
  CommissionTierName,
  TierRecommendation,
  LowerSeniorityRecommendation,
  QuoteRecommendations,
} from "./types";

export type { CommissionTierName, TierRecommendation, LowerSeniorityRecommendation, QuoteRecommendations };

export interface MarginResult {
  marginPct: number | null;
  dealWorthIt: boolean | null;
  finalPrice: number | null;
  tier: CommissionTierName | null;
  recommendations: QuoteRecommendations | null;
}

export interface UsaSavingsResult {
  usaSalary: number | null;
  monthlySavings: number | null;
  annualSavings: number | null;
}

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

const SENIORITY_ORDER = ["Junior", "Mid-Level", "Senior", "Senior+", "Senior++", "Senior+++"];

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
 * The price that would need to be charged, holding total salary fixed, to
 * hit each named tier. Mirrors the boundary conditions in getCommissionTier
 * above, solved for price given margin = (price - totalSalary) / price.
 */
function priceNeededForTier(totalSalary: number, target: "Safe-Strong" | "Hero"): number {
  if (target === "Safe-Strong") {
    // margin >= 0.35 AND spread >= 1000
    return Math.max(totalSalary / 0.65, totalSalary + 1000);
  }
  // Hero: margin >= 0.5, OR (margin >= 0.4 AND spread >= 1000) — take
  // whichever path gets there at a lower price.
  const viaMarginAlone = totalSalary / 0.5;
  const viaMarginAndSpread = Math.max(totalSalary / 0.6, totalSalary + 1000);
  return Math.min(viaMarginAlone, viaMarginAndSpread);
}

function buildTierRecommendations(
  totalSalary: number,
  finalPrice: number,
  marginPct: number,
  spread: number
): { toSafeStrong: TierRecommendation | null; toHero: TierRecommendation | null } {
  const meetsSafeStrong = marginPct >= 0.35 && spread >= 1000;
  const meetsHero = marginPct >= 0.5 || (marginPct >= 0.4 && spread >= 1000);

  const toSafeStrong = meetsSafeStrong
    ? null
    : (() => {
        const priceNeeded = priceNeededForTier(totalSalary, "Safe-Strong");
        return { targetTier: "Safe-Strong" as const, priceNeeded, priceIncrease: priceNeeded - finalPrice };
      })();

  const toHero = meetsHero
    ? null
    : (() => {
        const priceNeeded = priceNeededForTier(totalSalary, "Hero");
        return { targetTier: "Hero" as const, priceNeeded, priceIncrease: priceNeeded - finalPrice };
      })();

  return { toSafeStrong, toHero };
}

/**
 * Looks for a single role whose seniority could be lowered one step to get
 * the whole deal to at least a Safe-Strong margin — e.g. "this is thin as a
 * Senior hire, but scoping it as Mid-Level would clear the bar." Only
 * suggests a role/pricing_data combination that actually exists; picks the
 * candidate that yields the best resulting margin if more than one role
 * could be adjusted.
 */
function findLowerSeniorityRecommendation(
  roles: RoleScope[],
  matchedRows: PricingDataRow[],
  pricingData: PricingDataRow[]
): LowerSeniorityRecommendation | null {
  let best: LowerSeniorityRecommendation | null = null;

  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    const currentRow = matchedRows[i];
    const seniorityIndex = SENIORITY_ORDER.indexOf(currentRow.seniority);
    if (seniorityIndex <= 0) continue;
    const lowerSeniority = SENIORITY_ORDER[seniorityIndex - 1];

    let candidates = pricingData.filter(
      (row) =>
        row.role.toLowerCase() === currentRow.role.toLowerCase() &&
        row.seniority.toLowerCase() === lowerSeniority.toLowerCase()
    );
    if (role.region && role.region !== "Both") {
      candidates = candidates.filter((row) => row.region.toLowerCase() === role.region!.toLowerCase());
    }
    if (candidates.length === 0) continue;
    const altRow = candidates.reduce((cheapest, row) => (row.salary < cheapest.salary ? row : cheapest));

    const newRows = [...matchedRows];
    newRows[i] = altRow;
    const newTotalSalary = newRows.reduce((sum, row) => sum + row.salary, 0);
    const newFinalPrice = newRows.reduce((sum, row) => sum + row.targetPrice, 0);
    const newSpread = newFinalPrice - newTotalSalary;
    const newMarginPct = newSpread / newFinalPrice;

    const meetsSafeStrong = newMarginPct >= 0.35 && newSpread >= 1000;
    if (!meetsSafeStrong) continue;

    if (!best || newMarginPct > best.newMarginPct) {
      best = {
        roleId: role.id,
        roleTitle: role.title,
        currentSeniority: currentRow.seniority,
        suggestedSeniority: lowerSeniority,
        newMarginPct,
        newTier: getCommissionTier(newMarginPct, newSpread),
        newFinalPrice,
      };
    }
  }

  return best;
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
 * When the deal doesn't already clear Safe-Strong/Hero, `recommendations`
 * tells the rep concretely what would get it there — either a higher price
 * (roles unchanged) or a lower-seniority alternative for one role — instead
 * of just flagging it as thin with no next step.
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
    return { marginPct: null, dealWorthIt: null, finalPrice: null, tier: null, recommendations: null };
  }

  const matches = roles.map((role) => matchPricingRow(role, pricingData));
  if (matches.some((match) => match === null)) {
    return { marginPct: null, dealWorthIt: null, finalPrice: null, tier: null, recommendations: null };
  }
  const matchedRows = matches as PricingDataRow[];

  const totalSalary = matchedRows.reduce((sum, row) => sum + row.salary, 0);
  const finalPrice = matchedRows.reduce((sum, row) => sum + row.targetPrice, 0);

  if (finalPrice <= 0) {
    return { marginPct: null, dealWorthIt: null, finalPrice: null, tier: null, recommendations: null };
  }

  const spread = finalPrice - totalSalary;
  const marginPct = spread / finalPrice;
  const tier = getCommissionTier(marginPct, spread);
  const meetsFloor = matchedRows.every((row) => marginPct >= row.minMargin);
  const dealWorthIt = tier !== "Below Standard" && meetsFloor;

  // Always surface a path to Safe-Strong/Hero when the deal isn't already
  // there, even if it currently clears the floor (dealWorthIt) — the AE
  // should still see what it'd take to make this a stronger deal, not just
  // get warned when it's outright below standard.
  const { toSafeStrong, toHero } = buildTierRecommendations(totalSalary, finalPrice, marginPct, spread);
  const recommendations: QuoteRecommendations | null =
    toSafeStrong === null && toHero === null
      ? null
      : {
          toSafeStrong,
          toHero,
          lowerSeniority: toSafeStrong ? findLowerSeniorityRecommendation(roles, matchedRows, pricingData) : null,
        };

  return {
    marginPct,
    dealWorthIt,
    finalPrice,
    tier,
    recommendations,
  };
}

/**
 * What the client would pay for a comparable USA hire, and how much they
 * save going with us instead — using usaBenchmarkRole (a coarser,
 * AI-assigned category — see RoleScope) rather than pricing_data's
 * granular titles, since usa_benchmark_data uses a different taxonomy
 * (see db/seed-usa-benchmark.sql).
 *
 * All-or-nothing like calculateMargin: if any role has no usaBenchmarkRole
 * match, returns all nulls rather than a partial/misleading comparison.
 * `finalPrice` is what we're actually charging (from calculateMargin) —
 * savings = usaSalary - finalPrice.
 */
export function calculateUsaSavings(
  roles: RoleScope[],
  finalPrice: number | null,
  usaBenchmarkData: UsaBenchmarkRow[]
): UsaSavingsResult {
  if (roles.length === 0 || finalPrice === null) {
    return { usaSalary: null, monthlySavings: null, annualSavings: null };
  }

  const matches = roles.map((role) => {
    if (!role.usaBenchmarkRole || !role.seniority) return null;
    return (
      usaBenchmarkData.find(
        (row) =>
          row.role.toLowerCase() === role.usaBenchmarkRole!.toLowerCase() &&
          row.seniority.toLowerCase() === role.seniority!.toLowerCase()
      ) ?? null
    );
  });

  if (matches.some((match) => match === null)) {
    return { usaSalary: null, monthlySavings: null, annualSavings: null };
  }
  const matchedRows = matches as UsaBenchmarkRow[];

  const usaSalary = matchedRows.reduce((sum, row) => sum + row.salary, 0);
  const monthlySavings = usaSalary - finalPrice;

  return { usaSalary, monthlySavings, annualSavings: monthlySavings * 12 };
}
