import type { RoleScope, PricingDataRow } from "./types";

export interface MarginResult {
  marginPct: number | null;
  dealWorthIt: boolean | null;
  finalPrice: number | null;
}

/**
 * PLACEHOLDER — replace with our real margin calculation.
 *
 * This is intentionally a stub. Once the real formula is dropped in here,
 * it becomes the only place margin math lives (the old
 * scale-army-pricing-calculator app can be retired once this route is live).
 *
 * `pricingData` is the full contents of the pricing_data table — match each
 * role in `roles` against it (by title/seniority/region, however our real
 * matching logic works) to find salary/gmFloor/targetPrice/minMargin.
 */
export function calculateMargin(
  roles: RoleScope[],
  pricingData: PricingDataRow[]
): MarginResult {
  // TODO(seif): paste the real formula here. Stubbed to avoid pretending
  // this is production-ready before the real logic exists.
  void roles;
  void pricingData;

  return {
    marginPct: null,
    dealWorthIt: null,
    finalPrice: null,
  };
}
