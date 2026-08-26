/**
 * Mirrors web/lib/types.ts. Duplicated here (rather than shared via a
 * package) because the extension and the Next.js app build with different
 * toolchains and this repo only has two workspaces. If you change the
 * shape in web/lib/types.ts, update this file too.
 */

export type CallSessionStatus =
  | "scoping"
  | "scope_flagged"
  | "priced"
  | "jd_ready";

export interface TranscriptChunk {
  timestamp: string;
  speaker: string | null;
  text: string;
}

/** "Both" = client explicitly doesn't care which region; null = not asked/known yet. */
export type RoleRegion = "Africa" | "LATAM" | "Both";

export interface RoleScope {
  id: string;
  title: string | null;
  seniority: string | null;
  region: RoleRegion | null;
  mustHaves: string[];
  niceToHaves: string[];
  confidence: number;
  sourceQuotes: { timestamp: string; quote: string }[];
  /** Closest match from usa_benchmark_data's role list, for client savings. */
  usaBenchmarkRole: string | null;
}

export interface ScopeFlag {
  type: "multiple_roles_bundled" | "missing_field" | "budget_mismatch";
  message: string;
  roleIds: string[];
  resolved: boolean;
}

export interface JobDescription {
  roleId: string;
  content: string;
  generatedAt: string;
  approvedByClient: boolean;
}

export type CommissionTierName =
  | "Hero"
  | "Safe-Strong"
  | "Safe-Solid"
  | "Acceptable"
  | "Below Standard";

export interface TierRecommendation {
  targetTier: "Safe-Strong" | "Hero";
  priceNeeded: number;
  priceIncrease: number;
}

export interface LowerSeniorityRecommendation {
  roleId: string;
  roleTitle: string | null;
  currentSeniority: string;
  suggestedSeniority: string;
  newMarginPct: number;
  newTier: CommissionTierName;
  newFinalPrice: number;
}

export interface QuoteRecommendations {
  toSafeStrong: TierRecommendation | null;
  toHero: TierRecommendation | null;
  lowerSeniority: LowerSeniorityRecommendation | null;
}

/** Order-free checklist of whether each phase of a healthy call has been covered — see web/config/call-script.md. */
export interface CallPhases {
  agendaSet: boolean;
  discoveryCovered: boolean;
  consultativeDiagnosisGiven: boolean;
  processExplained: boolean;
  pricingDiscussed: boolean;
  closeAttempted: boolean;
}

export interface CallSession {
  id: string;
  meetLink: string;
  repEmail: string;
  status: CallSessionStatus;
  startedAt: string;
  transcript: TranscriptChunk[];
  roles: RoleScope[];
  scopeFlags: ScopeFlag[];
  callPhases: CallPhases;
  quote: {
    marginPct: number | null;
    dealWorthIt: boolean | null;
    finalPrice: number | null;
    tier: CommissionTierName | null;
    recommendations: QuoteRecommendations | null;
    usaSalary: number | null;
    monthlySavings: number | null;
    annualSavings: number | null;
    lockedAt: string | null;
  };
  jds: JobDescription[];
}
