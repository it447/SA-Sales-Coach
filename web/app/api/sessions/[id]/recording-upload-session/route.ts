import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { getSession } from "../../../../../lib/sessions";
import { getServiceAccountAccessToken } from "../../../../../lib/googleServiceAccount";
import { createResumableUploadSession } from "../../../../../lib/driveUpload";

/**
 * POST /api/sessions/:id/recording-upload-session — the extension calls
 * this right before it starts a tabCapture recording (see popup.ts), to get
 * a Google Drive resumable-upload URL to PUT the finished recording to
 * directly once the call ends. Uploads straight into the shared company
 * Drive folder (see driveUpload.ts for why that's simpler here than the
 * copy-out dance Meet's own native recording needs).
 *
 * Uses a dedicated service account (see googleServiceAccount.ts) rather than
 * the rep's own Google connection — recordings shouldn't depend on whether a
 * given rep has connected their account or their token still being valid.
 *
 * A failure here (no folder configured) isn't meant to block recording —
 * the extension falls back to a local download if it can't get an upload
 * URL.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  // Per direction: reps can override the default folder from the
  // extension's own settings (see popup.ts) rather than that being fixed
  // to one env var only an admin can change -- still requires the rep's
  // connected Google account to actually have access to whatever folder
  // they pick, same as the default does.
  let body: { folderId?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    // No body (or invalid JSON) just means no override -- fall through to the default.
  }
  const folderId = body.folderId || process.env.RECORDINGS_SHARED_DRIVE_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json(
      { error: "RECORDINGS_SHARED_DRIVE_FOLDER_ID is not configured on the server." },
      { status: 500 }
    );
  }

  // Named after the actual meeting, not a generic label + timestamp -- so
  // the recording is easy to find in Drive by the same name the rep sees
  // in Meet/the dashboard. Falls back to a timestamped generic name only
  // when meetingName wasn't captured (e.g. tab title unavailable).
  const filename = session.meetingName
    ? `${session.meetingName}.webm`
    : `Deal Assistant call - ${new Date().toISOString()}.webm`;

  try {
    const accessToken = await getServiceAccountAccessToken();
    const uploadUrl = await createResumableUploadSession(accessToken, filename, folderId, "video/webm");
    return NextResponse.json({ uploadUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
