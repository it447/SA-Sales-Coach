import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";
import type { ScopeFlag } from "../../../../../lib/types";

/**
 * POST /api/sessions/:id/scope-flags — lets the rep resolve (or otherwise
 * edit) scope flags from the sidebar. Client sends the full updated array
 * (e.g. one flag flipped to resolved: true); this recomputes status the
 * same way /extract does, so resolving the last open flag moves the
 * session back out of "scope_flagged".
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  let body: { scopeFlags?: ScopeFlag[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.scopeFlags)) {
    return NextResponse.json({ error: "scopeFlags (array) is required." }, { status: 400 });
  }

  const hasUnresolvedFlags = body.scopeFlags.some((f) => !f.resolved);
  const nextStatus =
    session.status === "scoping" || session.status === "scope_flagged"
      ? hasUnresolvedFlags
        ? "scope_flagged"
        : "scoping"
      : session.status;

  try {
    const result = await pool.query(
      "update call_sessions set scope_flags = $1::jsonb, status = $2 where id = $3 returning *",
      [JSON.stringify(body.scopeFlags), nextStatus, params.id]
    );
    return NextResponse.json(rowToSession(result.rows[0]));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
