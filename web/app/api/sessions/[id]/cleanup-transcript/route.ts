import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/authOptions";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";
import { cleanupTranscript } from "../../../../../lib/anthropic";

/**
 * POST /api/sessions/:id/cleanup-transcript — dashboard-only. Gated by the
 * human Google login (authOptions), not the extension's bearer-token
 * requireAuth(), like /summarize — this is only ever called from a
 * signed-in browser session, never the extension, and never during the
 * live call itself.
 *
 * Writes to `cleaned_transcript`, never `transcript` — the raw transcript
 * is what live extraction already ran against during the call, and keeping
 * it around means a cleanup pass that gets something wrong is never
 * destructive; the rep can always compare against the original.
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

  if (callSession.transcript.length === 0) {
    return NextResponse.json({ error: "No transcript to clean up yet." }, { status: 400 });
  }

  try {
    const cleaned = await cleanupTranscript(callSession.transcript);
    const result = await pool.query(
      "update call_sessions set cleaned_transcript = $1::jsonb where id = $2 returning *",
      [JSON.stringify(cleaned), params.id]
    );
    return NextResponse.json(rowToSession(result.rows[0]));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
