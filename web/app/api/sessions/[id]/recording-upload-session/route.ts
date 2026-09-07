import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { getSession } from "../../../../../lib/sessions";
import { getValidAccessToken } from "../../../../../lib/googleMeetAuth";
import { createResumableUploadSession } from "../../../../../lib/driveUpload";

/**
 * POST /api/sessions/:id/recording-upload-session — the extension calls
 * this right before it starts a tabCapture recording (see popup.ts), to get
 * a Google Drive resumable-upload URL to PUT the finished recording to
 * directly once the call ends. Uploads straight into the shared company
 * Drive folder (see driveUpload.ts for why that's simpler here than the
 * copy-out dance Meet's own native recording needs).
 *
 * A failure here (no Google connection, no folder configured) isn't meant
 * to block recording — the extension falls back to a local download if it
 * can't get an upload URL, so a rep who hasn't connected Google yet still
 * gets their recording, just not automatically filed in Drive.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const folderId = process.env.RECORDINGS_SHARED_DRIVE_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json(
      { error: "RECORDINGS_SHARED_DRIVE_FOLDER_ID is not configured on the server." },
      { status: 500 }
    );
  }

  const accessToken = await getValidAccessToken(session.repEmail);
  if (!accessToken) {
    return NextResponse.json(
      { error: `${session.repEmail} hasn't connected their Google account yet — connect it from the extension popup first.` },
      { status: 400 }
    );
  }

  const filename = `${session.meetingName ?? "Deal Assistant call"} - ${new Date().toISOString()}.webm`;

  try {
    const uploadUrl = await createResumableUploadSession(accessToken, filename, folderId, "video/webm");
    return NextResponse.json({ uploadUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
