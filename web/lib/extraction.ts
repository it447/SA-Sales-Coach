import { randomUUID } from "crypto";
import { pool } from "./db";
import { rowToSession } from "./sessions";
import { extractScope } from "./anthropic";
import type { CallSession, RoleScope, ScopeFlag, CallPhases } from "./types";

const UNCONFIRMED_THRESHOLD = 0.8;

/**
 * Once a phase is true it should never go back to false — a call doesn't
 * "un-cover" discovery just because the last couple minutes were about
 * something else. Belt-and-suspenders on top of the prompt telling Claude
 * the same thing: OR each phase against what was already true rather than
 * trusting the model's raw output not to regress.
 */
function mergeCallPhases(previous: CallPhases, next: CallPhases): CallPhases {
  return {
    agendaSet: previous.agendaSet || next.agendaSet,
    discoveryCovered: previous.discoveryCovered || next.discoveryCovered,
    consultativeDiagnosisGiven: previous.consultativeDiagnosisGiven || next.consultativeDiagnosisGiven,
    processExplained: previous.processExplained || next.processExplained,
    pricingDiscussed: previous.pricingDiscussed || next.pricingDiscussed,
    closeAttempted: previous.closeAttempted || next.closeAttempted,
  };
}

/**
 * Identifies a flag by what it's about, not its (possibly reworded)
 * message — same type, same affected role(s). Used to recognize "this is
 * the same underlying issue" across extraction calls.
 */
function flagKey(f: Pick<ScopeFlag, "type" | "roleIds">): string {
  return `${f.type}:${[...f.roleIds].sort().join(",")}`;
}

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
    severity: "warning",
  };
}

/**
 * Every tech role needs two specific answers before a JD can be generated
 * for it (see config/scoping-rules.md) — enforced for real in
 * /generate-jds, not just flagged here. Computed fresh from current role
 * state every pass rather than carried/merged like AI-sourced flags: it's
 * fully deterministic (isTechRole + firstTask/successOutcome), so the old
 * copy is simply replaced each time rather than dismissable — there's
 * nothing to "resolve" except actually getting the answers from the client.
 */
function detectMissingTechAnswers(roles: RoleScope[]): ScopeFlag[] {
  return roles
    .filter((role) => role.isTechRole && (!role.firstTask || !role.successOutcome))
    .map((role) => {
      const missing: string[] = [];
      if (!role.firstTask) missing.push("what they'll do first");
      if (!role.successOutcome) missing.push("what business outcome success looks like");
      return {
        type: "missing_tech_answers",
        message: `${role.title ?? "This tech role"}: still need to know ${missing.join(" and ")} — a JD can't be generated until both are answered.`,
        roleIds: [role.id],
        resolved: false,
        severity: "critical",
      };
    });
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
  const result = await extractScope(session.transcript, session.roles, session.callPhases);

  const newRoles: RoleScope[] = result.roles.map((role) => ({
    ...role,
    id: role.id ?? randomUUID(),
  }));

  const callPhases = mergeCallPhases(session.callPhases, result.callPhases);

  const creepFlag = detectScopeCreep(session.roles, newRoles);

  // Avoid re-flagging the exact same creep pair on every extract call.
  const alreadyFlagged = creepFlag
    ? session.scopeFlags.some((f) => !f.resolved && flagKey(f) === flagKey(creepFlag))
    : true;

  // Claude has no memory between calls of which flags the rep already
  // resolved — it just re-judges the transcript fresh every time, so a
  // still-true underlying issue (e.g. a role still missing its region)
  // gets flagged again even after being explicitly dismissed. Carry
  // forward previously-resolved flags and drop any of Claude's new flags
  // that match one of them, instead of blindly replacing the whole array
  // with Claude's fresh (memory-less) judgment every pass. missing_tech_
  // answers is excluded here since it's handled separately below (Claude
  // is instructed not to emit it at all — this filter is just a backstop).
  const previouslyResolvedKeys = new Set(session.scopeFlags.filter((f) => f.resolved).map(flagKey));
  const newUnresolvedFlags = result.scopeFlags.filter(
    (f) => f.type !== "missing_tech_answers" && !previouslyResolvedKeys.has(flagKey(f))
  );

  const techAnswerFlags = detectMissingTechAnswers(newRoles);

  const scopeFlags: ScopeFlag[] = [
    ...session.scopeFlags.filter((f) => f.resolved && f.type !== "missing_tech_answers"),
    ...newUnresolvedFlags,
    ...(creepFlag && !alreadyFlagged ? [creepFlag] : []),
    ...techAnswerFlags,
  ];

  const hasUnresolvedFlags = scopeFlags.some((f) => !f.resolved);
  const nextStatus =
    session.status === "scoping" || session.status === "scope_flagged"
      ? hasUnresolvedFlags
        ? "scope_flagged"
        : "scoping"
      : session.status;

  const updateResult = await pool.query(
    "update call_sessions set roles = $1::jsonb, scope_flags = $2::jsonb, status = $3, call_phases = $4::jsonb where id = $5 returning *",
    [JSON.stringify(newRoles), JSON.stringify(scopeFlags), nextStatus, JSON.stringify(callPhases), session.id]
  );

  return {
    session: rowToSession(updateResult.rows[0]),
    objectionSuggestions: result.objectionSuggestions,
  };
}
