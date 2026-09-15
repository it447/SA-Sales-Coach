import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/authOptions";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";
import { cleanupTranscript } from "../../../../../lib/anthropic";

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

  try {
    const cleaned = await cleanupTranscript(callSession.transcript);
    const result = await pool.query(
      "update call_sessions set cleaned_transcript = $1::jsonb where id = $2 returning *",
      [JSON.stringify(cleaned), params.id]
    );
    return NextResponse.json(rowToSession(result.rows[0]));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
