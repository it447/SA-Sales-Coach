import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/authOptions";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";
import { getValidAccessToken } from "../../../../../lib/googleMeetAuth";
import { getLatestRecordingFileId } from "../../../../../lib/meetSpace";
import { copyFileToSharedFolder } from "../../../../../lib/driveCopy";

/**
 * POST /api/sessions/:id/find-recording — dashboard-only, triggered
 * manually (like /summarize) rather than automatically, since Meet can take
 * a while after a call ends to finish processing a recording. Looks up the
 * rep's most recent recording for this call's meeting space, copies it from
 * their personal Drive into the shared company folder (see
 * lib/driveCopy.ts), and stores that copy's file ID on the session.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const callSession = await getSession(params.id);
  if (!callSession) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const folderId = process.env.RECORDINGS_SHARED_DRIVE_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json(
      { error: "RECORDINGS_SHARED_DRIVE_FOLDER_ID is not configured on the server." },
      { status: 500 }
    );
  }

  const accessToken = await getValidAccessToken(callSession.repEmail);
  if (!accessToken) {
    return NextResponse.json(
      { error: `${callSession.repEmail} hasn't connected their Google account yet.` },
      { status: 400 }
    );
  }

  try {
    const originalFileId = await getLatestRecordingFileId(accessToken, callSession.meetLink);
    if (!originalFileId) {
      return NextResponse.json(
        { error: "No recording found yet for this call — Meet can take a while to finish processing it after the call ends. Try again shortly." },
        { status: 404 }
      );
    }

    const copiedFileId = await copyFileToSharedFolder(accessToken, originalFileId, folderId);

    const result = await pool.query(
      "update call_sessions set recording_drive_file_id = $1 where id = $2 returning *",
      [copiedFileId, params.id]
    );
    return NextResponse.json(rowToSession(result.rows[0]));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
