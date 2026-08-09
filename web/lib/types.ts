/**
 * Core data model for Deal Assistant.
 *
 * This file is the single source of truth for the CallSession shape.
 * The Chrome extension keeps its own copy at extension/src/types.ts —
 * if you change something here, update that file too.
 */

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

export interface QuoteState {
  marginPct: number | null;
  dealWorthIt: boolean | null;
  finalPrice: number | null;
  /** Set only when the rep explicitly confirms price with the client. This is the gate for jds. */
  lockedAt: string | null;
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
