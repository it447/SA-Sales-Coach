import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/authOptions";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";

/**
 * POST /api/sessions/:id/set-recording-link — dashboard-only manual
 * fallback (see recording-panel.tsx). Gated by the human Google login
 * (authOptions), not the extension's bearer-token requireAuth(), like
 * find-recording/route.ts and the DELETE route above — this is only ever
 * called from a signed-in browser session.
 *
 * For whenever the automatic tabCapture-to-Drive linking (recording-uploaded/
 * route.ts) doesn't happen -- e.g. an older recording from before that
 * existed, or a rep who saved a local download and uploaded it to Drive by
 * hand -- so a session is never permanently stuck with no way to attach a
 * recording that does exist.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const callSession = await getSession(params.id);
  if (!callSession) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  let body: { driveLinkOrId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const raw = body.driveLinkOrId?.trim();
  if (!raw) {
    return NextResponse.json({ error: "A Drive link or file ID is required." }, { status: 400 });
  }

  // Accepts a full Drive share link (.../file/d/<id>/view, .../open?id=<id>)
  // or a bare file ID pasted directly -- whatever's easiest to copy out of
  // Drive's own "Share" dialog.
  const fileIdMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ?? raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const driveFileId = fileIdMatch ? fileIdMatch[1] : raw;
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(driveFileId)) {
    return NextResponse.json({ error: "That doesn't look like a valid Drive link or file ID." }, { status: 400 });
  }

  const result = await pool.query(
    "update call_sessions set recording_drive_file_id = $1 where id = $2 returning *",
    [driveFileId, params.id]
  );
  return NextResponse.json(rowToSession(result.rows[0]));
}
