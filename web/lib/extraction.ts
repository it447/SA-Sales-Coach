import { randomUUID } from "crypto";
import { pool } from "./db";
import { rowToSession } from "./sessions";
import { extractScope } from "./anthropic";
import type { CallSession, RoleScope, ScopeFlag } from "./types";

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

export interface ExtractionOutcome {
  session: CallSession;
  objectionSuggestions: string[];
}

/**
 * Runs the Claude extraction pass against a session's current transcript
 * and persists the result. Shared by /extract (standalone) and /ingest
 * (transcript + extract in one request, to save a round trip on the
 * extension's hot polling loop) so the logic lives in exactly one place.
 */
export async function runExtraction(session: CallSession): Promise<ExtractionOutcome> {
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

  const scopeFlags: ScopeFlag[] = [...result.scopeFlags, ...(creepFlag && !alreadyFlagged ? [creepFlag] : [])];

  const hasUnresolvedFlags = scopeFlags.some((f) => !f.resolved);
  const nextStatus =
    session.status === "scoping" || session.status === "scope_flagged"
      ? hasUnresolvedFlags
        ? "scope_flagged"
        : "scoping"
      : session.status;

  const updateResult = await pool.query(
    "update call_sessions set roles = $1::jsonb, scope_flags = $2::jsonb, status = $3 where id = $4 returning *",
    [JSON.stringify(newRoles), JSON.stringify(scopeFlags), nextStatus, session.id]
  );

  return {
    session: rowToSession(updateResult.rows[0]),
    objectionSuggestions: result.objectionSuggestions,
  };
}
