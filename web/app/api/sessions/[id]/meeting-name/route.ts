import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";

/**
 * POST /api/sessions/:id/meeting-name — lets the extension fill in the real
 * meeting name after session creation, once it's actually available.
 *
 * A session is created (see /api/sessions) the moment the content script
 * first sees a Meet page + config, reading the tab's title at that exact
 * instant -- but Meet is a SPA that often hasn't rendered the real calendar
 * event name into document.title yet at that point (it still just says
 * "Meet"), so meetingName ends up null and stays that way forever, since
 * nothing previously ever re-checked it. Confirmed on a real call: the
 * session's meetingName was null, so the Drive recording's filename (see
 * recording-upload-session/route.ts) fell back to a generic name instead
 * of matching the actual meeting invite.
 *
 * Only sets it if it isn't already set -- a rep manually renaming a session
 * later (if that ever becomes a feature) shouldn't get silently overwritten
 * by a late title-watcher poll from content-script.ts.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  let body: { meetingName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.meetingName) {
    return NextResponse.json({ error: "meetingName is required." }, { status: 400 });
  }

  if (session.meetingName) {
    return NextResponse.json(session);
  }

  const result = await pool.query(
    "update call_sessions set meeting_name = $1 where id = $2 returning *",
    [body.meetingName, params.id]
  );
  return NextResponse.json(rowToSession(result.rows[0]));
}
