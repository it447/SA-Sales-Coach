import { pool } from "./db";
import type { CallSession } from "./types";

/**
 * Raw shape of a call_sessions row as node-postgres returns it. jsonb
 * columns come back already parsed into JS values, timestamptz columns
 * come back as Date objects.
 */
interface CallSessionRow {
  id: string;
  meet_link: string;
  rep_email: string;
  status: string;
  started_at: Date;
  updated_at: Date;
  transcript: unknown;
  roles: unknown;
  scope_flags: unknown;
  call_phases: unknown;
  quote: unknown;
  jds: unknown;
  summary: string | null;
  meeting_name: string | null;
}

const DEFAULT_CALL_PHASES: CallSession["callPhases"] = {
  agendaSet: false,
  discoveryCovered: false,
  consultativeDiagnosisGiven: false,
  processExplained: false,
  pricingDiscussed: false,
  closeAttempted: false,
};

export function rowToSession(row: CallSessionRow): CallSession {
  return {
    id: row.id,
    meetLink: row.meet_link,
    meetingName: row.meeting_name ?? null,
    repEmail: row.rep_email,
    status: row.status as CallSession["status"],
    startedAt: row.started_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    transcript: row.transcript as CallSession["transcript"],
    roles: row.roles as CallSession["roles"],
    scopeFlags: row.scope_flags as CallSession["scopeFlags"],
    // Falls back for rows written before this column existed on a
    // deployment that hasn't re-run the migration yet.
    callPhases: (row.call_phases as CallSession["callPhases"]) ?? DEFAULT_CALL_PHASES,
    quote: row.quote as CallSession["quote"],
    jds: row.jds as CallSession["jds"],
    summary: row.summary ?? null,
  };
}

export async function getSession(id: string): Promise<CallSession | null> {
  const result = await pool.query<CallSessionRow>(
    "select * from call_sessions where id = $1",
    [id]
  );
  if (result.rows.length === 0) return null;
  return rowToSession(result.rows[0]);
}

/** Every call session, most recent first — powers the dashboard's session list. */
export async function listSessions(): Promise<CallSession[]> {
  const result = await pool.query<CallSessionRow>(
    "select * from call_sessions order by started_at desc"
  );
  return result.rows.map(rowToSession);
}

/** Permanently removes a call session. Admin-only — see lib/authOptions.ts's isAdmin flag. */
export async function deleteSession(id: string): Promise<boolean> {
  const result = await pool.query("delete from call_sessions where id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

/** What the dashboard shows as a session's title: the real meeting name if the extension captured one, else a role-derived fallback. */
export function sessionTitle(session: CallSession): string {
  return (
    session.meetingName ??
    (session.roles.map((r) => r.title ?? "Untitled role").join(", ") || "No roles scoped yet")
  );
}
