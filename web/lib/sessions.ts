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
  quote: unknown;
  jds: unknown;
}

export function rowToSession(row: CallSessionRow): CallSession {
  return {
    id: row.id,
    meetLink: row.meet_link,
    repEmail: row.rep_email,
    status: row.status as CallSession["status"],
    startedAt: row.started_at.toISOString(),
    transcript: row.transcript as CallSession["transcript"],
    roles: row.roles as CallSession["roles"],
    scopeFlags: row.scope_flags as CallSession["scopeFlags"],
    quote: row.quote as CallSession["quote"],
    jds: row.jds as CallSession["jds"],
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
