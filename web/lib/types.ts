/**
 * Core data model for Deal Assistant.
 *
 * This file is the single source of truth for the CallSession shape.
 * The Chrome extension keeps its own copy at extension/src/types.ts —
 * if you change something here, update that file too.
 */

/**
 * The 63 role categories in usa_benchmark_data that have a USA salary
 * figure — see db/seed-usa-benchmark.sql. Kept here as the single source of
 * truth so both the extraction prompt (lib/anthropic.ts) and the DB seed
 * script agree on exactly what's valid for RoleScope.usaBenchmarkRole.
 */
export const USA_BENCHMARK_ROLES = [
  "AI Engineering",
  "Account Executive",
  "Account Management",
  "Accountant",
  "Ad Creative Strategist",
  "Appointment Setter",
  "Bookkeeping",
  "Brand Marketing",
  "Business Development (BDR)",
  "Business Intelligence",
  "CRM (HubSpot, Salesforce) Ops",
  "Community Manager",
  "Content Marketing",
  "Controller",
  "Copywriting / Content Writing",
  "Creative Design",
  "Customer Service",
  "Customer Success",
  "Data Analysis",
  "Data Business Analysis",
  "Data Engineer",
  "Data Entry",
  "Data Science",
  "Demand Generation",
  "DevOps",
  "Ecommerce",
  "Email Marketing Automation / Klaviyo",
  "Email Marketing Designer",
  "Event Marketing",
  "Executive Assistant",
  "Full-Stack Developer/Engineer",
  "Graphic Designer",
  "Growth Marketing",
  "Human Resources",
  "Lead Generation",
  "ML Engineering",
  "Marketing",
  "Merger & Acquisitions",
  "Mobile Engineer",
  "No-Code Development",
  "PR & Communications",
  "Paid Media / PPC / Media Buyer",
  "Performance Marketing",
  "Procurement & Logistics",
  "Product Design",
  "Project Manager (Non-IT)",
  "Proposal Writing",
  "QA Automation",
  "QA Manual Testing",
  "Revenue Operations",
  "SEO / SEM",
  "Sales AI Enablement",
  "Sales Development (SDR)",
  "Sales Operations",
  "Sales Research",
  "Social Media",
  "Solutions Engineer",
  "Systems Automation",
  "Technical Customer Support",
  "Travel Agent",
  "UI/UX Design",
  "Video Editor",
  "Virtual Assistant",
] as const;

export type CallSessionStatus =
  | "scoping"
  | "scope_flagged"
  | "priced"
  | "jd_ready";

export interface TranscriptChunk {
  timestamp: string;
  /** Meet captions often don't give reliable speaker labels — null is fine. */
  speaker: string | null;
  text: string;
}

/**
 * "Both" means the client explicitly doesn't care which region the hire
 * comes from — not the same as null (not asked about / not yet known).
 */
export type RoleRegion = "Africa" | "LATAM" | "Both";

export interface RoleScope {
  id: string;
  title: string | null;
  seniority: string | null;
  /** null until asked/stated — a role isn't considered fully scoped without it. */
  region: RoleRegion | null;
  mustHaves: string[];
  niceToHaves: string[];
  /** 0-1 confidence that this extraction is accurate/complete. */
  confidence: number;
  sourceQuotes: { timestamp: string; quote: string }[];
  /**
   * The closest match for this role from usa_benchmark_data's coarser role
   * list (e.g. "Marketing Manager" -> "Marketing"), used to compute client
   * savings vs. a USA hire. null if nothing in that list reasonably fits —
   * see web/lib/anthropic.ts's EXTRACT_TOOL for the fixed list of values.
   */
  usaBenchmarkRole: string | null;
}

export type ScopeFlagType =
  | "multiple_roles_bundled"
  | "missing_field"
  | "budget_mismatch";

export interface ScopeFlag {
  type: ScopeFlagType;
  /** Shown to rep, e.g. "Sounds like 2 roles — worth splitting into separate quotes?" */
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
  /** The price that would need to be charged (roles/seniority unchanged) to hit this tier. */
  priceNeeded: number;
  /** How much higher than the current finalPrice that is. */
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

export interface QuoteState {
  marginPct: number | null;
  dealWorthIt: boolean | null;
  finalPrice: number | null;
  tier: CommissionTierName | null;
  /** Non-null whenever the deal isn't already Safe-Strong or Hero. */
  recommendations: QuoteRecommendations | null;
  /** How many of the call's roles actually contributed to finalPrice — less than totalRoleCount means this is a partial quote. */
  pricedRoleCount: number;
  totalRoleCount: number;
  /**
   * What a comparable USA hire would typically cost, for the "client
   * savings" comparison. null unless every role has a usaBenchmarkRole
   * match — see calculateUsaSavings in lib/pricing.ts.
   */
  usaSalary: number | null;
  monthlySavings: number | null;
  annualSavings: number | null;
  /** Set only when the rep explicitly confirms price with the client. This is the gate for jds. */
  lockedAt: string | null;
}

/**
 * Whether each phase of a healthy discovery call (see config/call-script.md)
 * has been covered so far — an order-free checklist, not a required
 * sequence, since real calls jump around based on what the client brings
 * up. Role scoping is deliberately not a field here: it's judged directly
 * from `roles`' completeness instead of asked of the AI a second time.
 */
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

  quote: QuoteState;

  jds: JobDescription[];
}

/** Row shape for the pricing_data table (mirrors the legacy pricing calculator's policies.json). */
export interface PricingDataRow {
  id: string;
  pod: string;
  role: string;
  family: string;
  seniority: string;
  region: string;
  salary: number;
  gmFloor: number;
  targetPrice: number;
  minMargin: number;
  skills: string[];
}

/** Row shape for the usa_benchmark_data table — see db/seed-usa-benchmark.sql. */
export interface UsaBenchmarkRow {
  id: string;
  role: string;
  category: string;
  seniority: string;
  salary: number;
}
