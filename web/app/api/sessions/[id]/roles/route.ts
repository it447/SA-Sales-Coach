import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";
import type { RoleScope } from "../../../../../lib/types";

/**
 * POST /api/sessions/:id/roles — lets the rep directly overwrite the roles
 * array from the sidebar (manual correction of whatever Claude extracted).
 * Not in the original route list, but needed for "editable by the rep" in
 * the sidebar (Phase 3) — extraction alone can't be hand-corrected
 * otherwise.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  let body: { roles?: RoleScope[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.roles)) {
    return NextResponse.json({ error: "roles (array) is required." }, { status: 400 });
  }

  try {
    const result = await pool.query(
      "update call_sessions set roles = $1::jsonb where id = $2 returning *",
      [JSON.stringify(body.roles), params.id]
    );
    return NextResponse.json(rowToSession(result.rows[0]));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
