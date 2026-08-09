import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";
import { generateJobDescription } from "../../../../../lib/anthropic";
import type { JobDescription } from "../../../../../lib/types";

/**
 * POST /api/sessions/:id/generate-jds — only runs if quote.lockedAt is set
 * (also enforced at the DB layer by a trigger, as a backstop). Drafts a JD
 * per role and sets status to "jd_ready".
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (!session.quote.lockedAt) {
    return NextResponse.json(
      { error: "Price must be locked (via /lock-price) before generating JDs." },
      { status: 400 }
    );
  }

  try {
    const generated = await Promise.all(
      session.roles.map(async (role): Promise<JobDescription> => ({
        roleId: role.id,
        content: await generateJobDescription(role),
        generatedAt: new Date().toISOString(),
        approvedByClient: false,
      }))
    );

    // Regenerating replaces any existing JD for the same role; keeps JDs
    // for roles not in this batch (shouldn't normally happen, but harmless).
    const generatedRoleIds = new Set(generated.map((jd) => jd.roleId));
    const jds = [...session.jds.filter((jd) => !generatedRoleIds.has(jd.roleId)), ...generated];

    const result = await pool.query(
      "update call_sessions set jds = $1::jsonb, status = 'jd_ready' where id = $2 returning *",
      [JSON.stringify(jds), params.id]
    );

    return NextResponse.json(rowToSession(result.rows[0]));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
