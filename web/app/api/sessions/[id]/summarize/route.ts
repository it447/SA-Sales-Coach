import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/authOptions";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";
import { generateCallSummary } from "../../../../../lib/anthropic";

/**
 * POST /api/sessions/:id/summarize — dashboard-only (Phase 4). Gated by the
 * human Google login (authOptions), not the extension's bearer-token
 * requireAuth(), since this is only ever called from a signed-in browser
 * session, never the extension.
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

  try {
    const summary = await generateCallSummary(callSession);
    const result = await pool.query(
      "update call_sessions set summary = $1 where id = $2 returning *",
      [summary, params.id]
    );
    return NextResponse.json(rowToSession(result.rows[0]));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
