import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { getSession } from "../../../../../lib/sessions";

/**
 * GET /api/sessions/:id/recording-destination — a cheap, read-only check
 * the extension calls to show the rep WHERE a recording will actually be
 * saved before they click Start Recording (see popup.ts), rather than
 * them finding out only after clicking Stop. Deliberately does NOT create
 * a Drive resumable-upload session the way recording-upload-session/
 * route.ts does (that's a real Drive-side resource, wasteful to spin up
 * just for a UI preview) -- this only checks the same precondition that
 * route needs (the shared folder being configured). Uploads run through a
 * service account (see googleServiceAccount.ts), so there's no per-rep
 * Google connection to check here anymore.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  // See recording-upload-session/route.ts -- a rep-supplied folderId (from
  // the extension's own settings) overrides the server's default.
  const folderId = request.nextUrl.searchParams.get("folderId") || process.env.RECORDINGS_SHARED_DRIVE_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json({ destination: "local", reason: "Shared Drive folder isn't configured yet." });
  }

  return NextResponse.json({ destination: "drive" });
}
