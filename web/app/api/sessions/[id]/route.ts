import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAuth } from "../../../../lib/auth";
import { authOptions } from "../../../../lib/authOptions";
import { getSession, deleteSession } from "../../../../lib/sessions";

/** GET /api/sessions/:id — returns full session state, polled by the extension sidebar. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const session = await getSession(params.id);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/:id — dashboard-only (Phase 4), admin-only. Gated by
 * the human Google login (authOptions), not the extension's bearer-token
 * requireAuth(), since this is only ever called from a signed-in browser
 * session, never the extension.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const deleted = await deleteSession(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
