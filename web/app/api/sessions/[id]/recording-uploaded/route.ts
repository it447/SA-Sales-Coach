import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";

/**
 * POST /api/sessions/:id/recording-uploaded — the extension calls this
 * right after successfully PUTting a tabCapture recording to the Drive
 * upload-session URL from recording-upload-session/route.ts, to record the
 * resulting file's ID against this session. Writes to the same
 * recording_drive_file_id column Meet-native recordings use (see
 * find-recording/route.ts) — the dashboard doesn't need to care which path
 * produced the file.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  let body: { driveFileId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.driveFileId) {
    return NextResponse.json({ error: "driveFileId is required." }, { status: 400 });
  }

  const result = await pool.query(
    "update call_sessions set recording_drive_file_id = $1 where id = $2 returning *",
    [body.driveFileId, params.id]
  );
  return NextResponse.json(rowToSession(result.rows[0]));
}
