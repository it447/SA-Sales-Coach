import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";
import { getValidAccessToken } from "../../../../../lib/googleMeetAuth";
import { setSpaceRecording } from "../../../../../lib/meetSpace";

/**
 * POST /api/sessions/:id/recording — the extension calls this right after
 * creating a new session (see content-script.ts's ensureSession), before
 * the rep clicks "Join now". Turns Google Meet's native recording on/off
 * for that call via the rep's connected Google account (see
 * app/api/google/connect) — there's no live mid-call toggle possible here,
 * since autoRecordingGeneration only takes effect at join time.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  let body: { enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) is required." }, { status: 400 });
  }

  const accessToken = await getValidAccessToken(session.repEmail);
  if (!accessToken) {
    return NextResponse.json(
      { error: `${session.repEmail} hasn't connected their Google account for recording yet.` },
      { status: 400 }
    );
  }

  try {
    await setSpaceRecording(accessToken, session.meetLink, body.enabled);
    const result = await pool.query(
      "update call_sessions set recording_enabled = $1 where id = $2 returning *",
      [body.enabled, params.id]
    );
    return NextResponse.json(rowToSession(result.rows[0]));
  } catch (err) {
    await pool.query("update call_sessions set recording_enabled = false where id = $1", [params.id]);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
