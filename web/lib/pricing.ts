import type {
  RoleScope,
  PricingDataRow,
  UsaBenchmarkRow,
  CommissionTierName,
  TierRecommendation,
  LowerSeniorityRecommendation,
  QuoteRecommendations,
  PriceTiers,
  AtClientBudget,
} from "./types";

export type {
  CommissionTierName,
  TierRecommendation,
  LowerSeniorityRecommendation,
  QuoteRecommendations,
  PriceTiers,
  AtClientBudget,
};

export interface MarginResult {
  marginPct: number | null;
  dealWorthIt: boolean | null;
  finalPrice: number | null;
  tier: CommissionTierName | null;
  recommendations: QuoteRecommendations | null;
  /** How many of the call's roles actually contributed to finalPrice. */
  pricedRoleCount: number;
  totalRoleCount: number;
  /** The subset of roles that got priced — same roles finalPrice reflects, for calculateUsaSavings to stay apples-to-apples with a partial quote. */
  pricedRoles: RoleScope[];
  /** Always populated whenever anything is priced — the reference ladder, like the standalone pricing calculator shows. */
  priceTiers: PriceTiers | null;
  /** null unless every priced role has a stated clientBudget. */
  atClientBudget: AtClientBudget | null;
  /** Every role that didn't make it into finalPrice, with a human reason why — so a rep clicking "Calculate Price" with something missing sees what, instead of the button silently doing nothing. */
  unpricedRoles: UnpricedRole[];
}

export interface UnpricedRole {
  roleId: string;
  roleTitle: string | null;
  reason: string;
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
 * Cost premiums, lifted verbatim from the standalone pricing calculator's
 * "Salary Adjustments" checkboxes. "If two or more apply, only the highest
 * percentage is applied ONCE" — see adjustmentMultiplier below.
 */
export const SALARY_ADJUSTMENT_PCT = {
  englishLevel: 0.2,
  certainIndustries: 0.3,
  superNicheTech: 0.15,
  seniorityAnd360: 0.3,
} as const;

/**
 * The multiplier to apply to a role's base salary from pricing_data, based
 * on whichever salaryAdjustments flags extraction detected — only the
 * highest applicable percentage counts, never stacked.
 */
function adjustmentMultiplier(role: RoleScope): number {
  const adj = role.salaryAdjustments;
  if (!adj) return 1;
  const pct = Math.max(
    adj.englishLevel ? SALARY_ADJUSTMENT_PCT.englishLevel : 0,
    adj.certainIndustries ? SALARY_ADJUSTMENT_PCT.certainIndustries : 0,
    adj.superNicheTech ? SALARY_ADJUSTMENT_PCT.superNicheTech : 0,
    adj.seniorityAnd360 ? SALARY_ADJUSTMENT_PCT.seniorityAnd360 : 0
  );
  return 1 + pct;
}

/** A pricing_data row's salary after applying its role's detected cost premium, if any. */
function adjustedSalary(role: RoleScope, row: PricingDataRow): number {
  return row.salary * adjustmentMultiplier(role);
}

const SALARY_ADJUSTMENT_LABELS: Record<keyof typeof SALARY_ADJUSTMENT_PCT, string> = {
  englishLevel: "English level",
  certainIndustries: "Certain industries",
  superNicheTech: "Super niche technologies",
  seniorityAnd360: "Seniority and 360 responsibilities",
};

/** Human-readable label for whichever adjustment actually applies to this role's price (the highest-percentage one detected), for display in the dashboard. null if none apply. */
export function describeSalaryAdjustment(role: RoleScope): string | null {
  const adj = role.salaryAdjustments;
  if (!adj) return null;
  const applicable = (Object.keys(SALARY_ADJUSTMENT_PCT) as (keyof typeof SALARY_ADJUSTMENT_PCT)[]).filter(
    (key) => adj[key]
  );
  if (applicable.length === 0) return null;
  const best = applicable.reduce((max, key) => (SALARY_ADJUSTMENT_PCT[key] > SALARY_ADJUSTMENT_PCT[max] ? key : max));
  return `${SALARY_ADJUSTMENT_LABELS[best]} (+${Math.round(SALARY_ADJUSTMENT_PCT[best] * 100)}%)`;
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

/** Explains why matchPricingRow returned null for this role, in plain English for the sidebar. */
function explainUnpricedRole(role: RoleScope, pricingData: PricingDataRow[]): string {
  if (!role.title) return "Role title not captured yet.";
  if (!role.seniority) return "Seniority not captured yet.";

  const titleSeniorityMatches = pricingData.filter(
    (row) =>
      row.role.toLowerCase() === role.title!.toLowerCase() &&
      row.seniority.toLowerCase() === role.seniority!.toLowerCase()
  );

  if (titleSeniorityMatches.length === 0) {
    return `"${role.title}" (${role.seniority}) isn't a recognized pricing title — try a more standard job title.`;
  }

  return `No pricing data for "${role.title}" (${role.seniority}) in the ${role.region ?? "stated"} region.`;
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

/** Nearest $50, matching the legacy pricing calculator's convention for reference numbers ($4,307.69 reads as a real quote; $4,300 reads as a reference point). */
function roundTo50(n: number): number {
  return Math.round(n / 50) * 50;
}

/**
 * The permanent reference ladder — what it'd take to hit each tier, always
 * shown (unlike `recommendations`, which only appears when the deal isn't
 * already there). Acceptable only requires margin >= 0.35, no spread floor
 * — Safe-Strong is the same margin plus a $1,000 spread minimum.
 */
function buildPriceTiers(totalSalary: number): PriceTiers {
  return {
    acceptable: roundTo50(totalSalary / 0.65),
    safeStrong: roundTo50(priceNeededForTier(totalSalary, "Safe-Strong")),
    hero: roundTo50(priceNeededForTier(totalSalary, "Hero")),
  };
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
    const newTotalSalary = newRows.reduce((sum, row, idx) => sum + adjustedSalary(roles[idx], row), 0);
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
 * Prices whatever roles ARE fully scoped and have a matching pricing_data
 * row, even if others on the call aren't ready yet — one incomplete role
 * (e.g. missing seniority) no longer blocks pricing for the rest.
 * `pricedRoleCount`/`totalRoleCount` tell the caller whether this is a
 * partial quote so the UI can say so, instead of presenting it as final.
 * Returns nulls only when NO role is priceable yet.
 */
export function calculateMargin(
  roles: RoleScope[],
  pricingData: PricingDataRow[]
): MarginResult {
  const totalRoleCount = roles.length;
  if (totalRoleCount === 0) {
    return {
      marginPct: null,
      dealWorthIt: null,
      finalPrice: null,
      tier: null,
      recommendations: null,
      pricedRoleCount: 0,
      totalRoleCount,
      pricedRoles: [],
      priceTiers: null,
      atClientBudget: null,
      unpricedRoles: [],
    };
  }

  const pricedPairs = roles
    .map((role) => ({ role, row: matchPricingRow(role, pricingData) }))
    .filter((pair): pair is { role: RoleScope; row: PricingDataRow } => pair.row !== null);

  const pricedRoleIds = new Set(pricedPairs.map((pair) => pair.role.id));
  const unpricedRoles: UnpricedRole[] = roles
    .filter((role) => !pricedRoleIds.has(role.id))
    .map((role) => ({
      roleId: role.id,
      roleTitle: role.title,
      reason: explainUnpricedRole(role, pricingData),
    }));

  const nullResult: MarginResult = {
    marginPct: null,
    dealWorthIt: null,
    finalPrice: null,
    tier: null,
    recommendations: null,
    pricedRoleCount: 0,
    totalRoleCount,
    pricedRoles: [],
    priceTiers: null,
    atClientBudget: null,
    unpricedRoles,
  };

  if (pricedPairs.length === 0) return nullResult;

  const pricedRoles = pricedPairs.map((pair) => pair.role);
  const matchedRows = pricedPairs.map((pair) => pair.row);

  // Cost premiums (salaryAdjustments) raise the effective salary used for
  // margin/tier math, same as the standalone calculator's "Adjusted Range"
  // — but NOT pricing_data's curated targetPrice, which stays our standard
  // asking price for the role regardless of cost. That's deliberate: a
  // pricier-to-source role should show thinner margin at the same price,
  // prompting the rep to ask for more — not have the recommendation quietly
  // inflate to hide it.
  const totalSalary = pricedPairs.reduce((sum, pair) => sum + adjustedSalary(pair.role, pair.row), 0);
  const finalPrice = matchedRows.reduce((sum, row) => sum + row.targetPrice, 0);

  if (finalPrice <= 0) return nullResult;

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
          lowerSeniority: toSafeStrong
            ? findLowerSeniorityRecommendation(pricedRoles, matchedRows, pricingData)
            : null,
        };

  const priceTiers = buildPriceTiers(totalSalary);

  // Only meaningful when every priced role has a stated number — a partial
  // sum (e.g. one role's budget plus another role with none) would be a
  // fabricated total, not something the client actually said. typeof check
  // (not !== null) because roles scoped before this field existed have no
  // clientBudget key at all — undefined, not null.
  const atClientBudget: AtClientBudget | null = pricedRoles.every((role) => typeof role.clientBudget === "number")
    ? (() => {
        const budget = pricedRoles.reduce((sum, role) => sum + (role.clientBudget as number), 0);
        if (budget <= 0) return null;
        const budgetSpread = budget - totalSalary;
        const budgetMarginPct = budgetSpread / budget;
        const budgetTier = getCommissionTier(budgetMarginPct, budgetSpread);
        return {
          budget,
          marginPct: budgetMarginPct,
          tier: budgetTier,
          dealWorthIt: budgetTier !== "Below Standard" && matchedRows.every((row) => budgetMarginPct >= row.minMargin),
        };
      })()
    : null;

  return {
    marginPct,
    dealWorthIt,
    finalPrice,
    tier,
    recommendations,
    pricedRoleCount: pricedRoles.length,
    totalRoleCount,
    pricedRoles,
    priceTiers,
    atClientBudget,
    unpricedRoles,
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
