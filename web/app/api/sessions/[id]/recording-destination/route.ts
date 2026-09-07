import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { getSession } from "../../../../../lib/sessions";
import { getValidAccessToken } from "../../../../../lib/googleMeetAuth";

/**
 * GET /api/sessions/:id/recording-destination — a cheap, read-only check
 * the extension calls to show the rep WHERE a recording will actually be
 * saved before they click Start Recording (see popup.ts), rather than
 * them finding out only after clicking Stop. Deliberately does NOT create
 * a Drive resumable-upload session the way recording-upload-session/
 * route.ts does (that's a real Drive-side resource, wasteful to spin up
 * just for a UI preview) -- this only checks the same two preconditions
 * that route needs (a valid Google connection, the shared folder being
 * configured) without touching Drive's API at all.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const folderId = process.env.RECORDINGS_SHARED_DRIVE_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json({ destination: "local", reason: "Shared Drive folder isn't configured yet." });
  }

  const accessToken = await getValidAccessToken(session.repEmail);
  if (!accessToken) {
    return NextResponse.json({ destination: "local", reason: "Google account not connected yet." });
  }

  return NextResponse.json({ destination: "drive" });
}
