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

export interface CallSession {
  id: string;
  meetLink: string;
  repEmail: string;
  status: CallSessionStatus;
  startedAt: string;
  transcript: TranscriptChunk[];
  roles: RoleScope[];
  scopeFlags: ScopeFlag[];
  quote: {
    marginPct: number | null;
    dealWorthIt: boolean | null;
    finalPrice: number | null;
    lockedAt: string | null;
  };
  jds: JobDescription[];
}
