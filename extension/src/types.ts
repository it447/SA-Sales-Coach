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
  /** A specific monthly number the client stated for this role's budget, if any. Top of range if they gave one. */
  clientBudget: number | null;
  /** True for technical/engineering roles — gates the firstTask/successOutcome requirement. */
  isTechRole: boolean;
  /** Answer to "what's the first thing this person will do when they start?" Required for tech roles before a JD can be generated. */
  firstTask: string | null;
  /** Answer to "what business outcome would an excellent hire drive?" Required for tech roles before a JD can be generated. */
  successOutcome: string | null;
  /** Cost premiums detected from the transcript, mirroring the standalone pricing calculator's "Salary Adjustments" checkboxes. Only the highest applicable one is applied. */
  salaryAdjustments: {
    englishLevel: boolean;
    certainIndustries: boolean;
    superNicheTech: boolean;
    seniorityAnd360: boolean;
  };
}

export interface ScopeFlag {
  type: "multiple_roles_bundled" | "missing_field" | "budget_mismatch" | "missing_tech_answers";
  message: string;
  roleIds: string[];
  resolved: boolean;
  /** "critical" flags render distinctly (red) and have no Resolve button — they clear only once the underlying data is actually answered. */
  severity: "critical" | "warning";
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

/** Always-shown reference ladder — the price needed for each tier, roles/seniority unchanged. */
export interface PriceTiers {
  acceptable: number;
  safeStrong: number;
  hero: number;
}

/** What the deal looks like at the number the client actually said. */
export interface AtClientBudget {
  budget: number;
  marginPct: number;
  tier: CommissionTierName;
  dealWorthIt: boolean;
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
  /** The actual Google Meet call title, read from the tab title when the rep starts the session. */
  meetingName: string | null;
  repEmail: string;
  status: CallSessionStatus;
  startedAt: string;
  updatedAt: string;
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
    priceTiers: PriceTiers | null;
    atClientBudget: AtClientBudget | null;
    pricedRoleCount: number;
    totalRoleCount: number;
    unpricedRoles: { roleId: string; roleTitle: string | null; reason: string }[];
    usaSalary: number | null;
    monthlySavings: number | null;
    annualSavings: number | null;
    lockedAt: string | null;
  };
  jds: JobDescription[];

  /** AI-generated recap, generated on demand from the dashboard — not touched by the extension. */
  summary: string | null;

  /** null until recording was attempted for this call; true/false once known. */
  recordingEnabled: boolean | null;

  /** Drive file ID of the recording, once the dashboard locates it — not touched by the extension. */
  recordingDriveFileId: string | null;
}
