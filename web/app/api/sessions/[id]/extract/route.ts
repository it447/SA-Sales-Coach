import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";
import { extractScope } from "../../../../../lib/anthropic";
import type { RoleScope, ScopeFlag } from "../../../../../lib/types";

const UNCONFIRMED_THRESHOLD = 0.8;

/**
 * Detects scope creep: a new role showing up while an existing role is
 * still unconfirmed (low confidence). This is deliberately NOT a separate
 * "creep detector" pass — it's just how roles get appended, per the data
 * model rules.
 */
function detectScopeCreep(oldRoles: RoleScope[], newRoles: RoleScope[]): ScopeFlag | null {
  const oldIds = new Set(oldRoles.map((r) => r.id));
  const addedRoles = newRoles.filter((r) => !oldIds.has(r.id));
  if (addedRoles.length === 0) return null;

  const stillOpenOldRoles = oldRoles.filter(
    (r) => r.confidence < UNCONFIRMED_THRESHOLD && newRoles.some((nr) => nr.id === r.id)
  );
  if (stillOpenOldRoles.length === 0) return null;

  const roleIds = [...stillOpenOldRoles.map((r) => r.id), ...addedRoles.map((r) => r.id)];
  return {
    type: "multiple_roles_bundled",
    message: `Sounds like ${newRoles.length} roles now — worth splitting into separate quotes?`,
    roleIds,
    resolved: false,
  };
}

/**
 * POST /api/sessions/:id/extract — runs after new transcript chunks come
 * in. Calls Claude to update role scope, detect flags, and surface
 * objection-handling suggestions.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (session.transcript.length === 0) {
    return NextResponse.json({ error: "No transcript to extract from yet." }, { status: 400 });
  }

  try {
    const result = await extractScope(session.transcript, session.roles);

    const newRoles: RoleScope[] = result.roles.map((role) => ({
      ...role,
      id: role.id ?? randomUUID(),
    }));

    const creepFlag = detectScopeCreep(session.roles, newRoles);

    // Avoid re-flagging the exact same creep pair on every extract call.
    const alreadyFlagged = creepFlag
      ? session.scopeFlags.some(
          (f) =>
            f.type === "multiple_roles_bundled" &&
            !f.resolved &&
            JSON.stringify([...f.roleIds].sort()) === JSON.stringify([...creepFlag.roleIds].sort())
        )
      : true;

    const scopeFlags: ScopeFlag[] = [
      ...result.scopeFlags,
      ...(creepFlag && !alreadyFlagged ? [creepFlag] : []),
    ];

    const hasUnresolvedFlags = scopeFlags.some((f) => !f.resolved);
    const nextStatus =
      session.status === "scoping" || session.status === "scope_flagged"
        ? hasUnresolvedFlags
          ? "scope_flagged"
          : "scoping"
        : session.status;

    const updateResult = await pool.query(
      "update call_sessions set roles = $1::jsonb, scope_flags = $2::jsonb, status = $3 where id = $4 returning *",
      [JSON.stringify(newRoles), JSON.stringify(scopeFlags), nextStatus, params.id]
    );

    return NextResponse.json({
      session: rowToSession(updateResult.rows[0]),
      objectionSuggestions: result.objectionSuggestions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
