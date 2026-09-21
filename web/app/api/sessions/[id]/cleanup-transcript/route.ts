import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/authOptions";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";
import { cleanupTranscript, generateScorecard } from "../../../../../lib/anthropic";
import { saveScorecard } from "../../../../../lib/scorecards";
import { sendScorecardToSlack } from "../../../../../lib/scorecardSlack";
import type { TranscriptChunk } from "../../../../../lib/types";

// Cleanup itself is quick, but the scorecard pass below it (two real Claude
// calls, one with a large output budget) can take a couple of minutes on a
// long call -- the default serverless timeout isn't enough. See
// lib/anthropic.ts's generateScorecard for why the scorecard half streams.
export const maxDuration = 300;

/**
 * POST /api/sessions/:id/cleanup-transcript — callable either from the
 * dashboard (a signed-in Google login, the original manual "Clean up
 * transcript" / "Re-clean transcript" button) or from the extension itself
 * via its bearer-token requireAuth(), which now triggers this
 * automatically the moment the rep leaves the call (see content-script.ts's
 * watchForCallLeave) so a cleaned transcript is usually already sitting on
 * the dashboard by the time anyone opens it, no button needed.
 *
 * Writes to `cleaned_transcript`, never `transcript` — the raw transcript
 * is what live extraction already ran against during the call, and keeping
 * it around means a cleanup pass that gets something wrong is never
 * destructive; the rep can always compare against the original.
 *
 * Once the transcript is cleaned, also generates a call scorecard (see
 * lib/anthropic.ts's generateScorecard, scored against
 * config/scorecard-rubric.md) and posts it to Slack. This is best-effort:
 * a scoring failure never fails the cleanup response the caller is waiting
 * on, since the cleaned transcript is the more time-sensitive of the two.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const dashboardSession = await getServerSession(authOptions);
  if (!dashboardSession) {
    const authError = requireAuth(request);
    if (authError) return authError;
  }

  const callSession = await getSession(params.id);
  if (!callSession) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (callSession.transcript.length === 0) {
    return NextResponse.json({ error: "No transcript to clean up yet." }, { status: 400 });
  }

  let cleaned: TranscriptChunk[];
  let updatedSession: ReturnType<typeof rowToSession>;
  try {
    cleaned = await cleanupTranscript(callSession.transcript);
    const result = await pool.query(
      "update call_sessions set cleaned_transcript = $1::jsonb where id = $2 returning *",
      [JSON.stringify(cleaned), params.id]
    );
    updatedSession = rowToSession(result.rows[0]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  try {
    const scorecard = await generateScorecard(cleaned);
    await saveScorecard(params.id, scorecard);
    await sendScorecardToSlack({
      scorecard,
      repEmail: callSession.repEmail,
      reportUrl: `${request.nextUrl.origin}/dashboard/${params.id}`,
    });
  } catch (err) {
    console.error(`Scorecard generation failed for session ${params.id}:`, err);
  }

  return NextResponse.json(updatedSession);
}
