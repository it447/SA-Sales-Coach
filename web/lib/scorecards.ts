import { pool } from "./db";
import type { CallScorecard, ScorecardResult } from "./types";

interface CallScorecardRow {
  id: string;
  session_id: string;
  created_at: Date;
  result: unknown;
}

function rowToScorecard(row: CallScorecardRow): CallScorecard {
  return {
    id: row.id,
    sessionId: row.session_id,
    createdAt: row.created_at.toISOString(),
    result: row.result as ScorecardResult,
  };
}

/**
 * The most recent scorecard for a session, or null if it hasn't been scored
 * yet -- also null (rather than throwing) if the call_scorecards table
 * itself doesn't exist yet on a deployment that hasn't run the migration.
 * The session detail page calls this unconditionally for every session, so
 * a missing table here must never take the whole page down -- it should
 * just mean no scorecard panel shows, same as a call that hasn't scored.
 */
export async function getLatestScorecard(sessionId: string): Promise<CallScorecard | null> {
  try {
    const result = await pool.query<CallScorecardRow>(
      "select * from call_scorecards where session_id = $1 order by created_at desc limit 1",
      [sessionId]
    );
    if (result.rows.length === 0) return null;
    return rowToScorecard(result.rows[0]);
  } catch (err) {
    console.error(`Failed to load scorecard for session ${sessionId}:`, err);
    return null;
  }
}

/** Saves a newly generated scorecard. Each scoring run inserts a new row, matching how re-cleaning a transcript can change the result. */
export async function saveScorecard(sessionId: string, scorecard: ScorecardResult): Promise<CallScorecard> {
  const result = await pool.query<CallScorecardRow>(
    "insert into call_scorecards (session_id, overall_score, max_score, sql_status, result) values ($1, $2, $3, $4, $5::jsonb) returning *",
    [sessionId, scorecard.overall_score, scorecard.max_score, scorecard.sql.status, JSON.stringify(scorecard)]
  );
  return rowToScorecard(result.rows[0]);
}
