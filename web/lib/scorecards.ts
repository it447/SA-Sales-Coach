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

/** The most recent scorecard for a session, or null if it hasn't been scored yet. */
export async function getLatestScorecard(sessionId: string): Promise<CallScorecard | null> {
  const result = await pool.query<CallScorecardRow>(
    "select * from call_scorecards where session_id = $1 order by created_at desc limit 1",
    [sessionId]
  );
  if (result.rows.length === 0) return null;
  return rowToScorecard(result.rows[0]);
}

/** Saves a newly generated scorecard. Each scoring run inserts a new row, matching how re-cleaning a transcript can change the result. */
export async function saveScorecard(sessionId: string, scorecard: ScorecardResult): Promise<CallScorecard> {
  const result = await pool.query<CallScorecardRow>(
    "insert into call_scorecards (session_id, overall_score, max_score, sql_status, result) values ($1, $2, $3, $4, $5::jsonb) returning *",
    [sessionId, scorecard.overall_score, scorecard.max_score, scorecard.sql.status, JSON.stringify(scorecard)]
  );
  return rowToScorecard(result.rows[0]);
}
