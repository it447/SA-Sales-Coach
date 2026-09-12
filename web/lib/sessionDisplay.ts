import type { CallSession } from "./types";

/**
 * Pure display helpers split out of sessions.ts specifically so they can be
 * imported from a client component (session-card.tsx, via session-list.tsx)
 * without pulling in sessions.ts's `pool`/pg import chain -- Next.js bundles
 * an entire imported file's dependencies for the client, and pg transitively
 * needs Node built-ins (fs/net/dns/tls) that don't exist in the browser,
 * which broke the build the first time session-card.tsx ended up reachable
 * from a "use client" file.
 */

/** What the dashboard shows as a session's title: the real meeting name if the extension captured one, else a role-derived fallback. */
export function sessionTitle(session: CallSession): string {
  return (
    session.meetingName ??
    (session.roles.map((r) => r.title ?? "Untitled role").join(", ") || "No roles scoped yet")
  );
}

/** % of the six call-structure phases (see CallPhases) covered so far — the dashboard's "scope completeness" badge. */
export function scopeCompletionPercent(session: CallSession): number {
  const values = Object.values(session.callPhases);
  const covered = values.filter(Boolean).length;
  return Math.round((covered / values.length) * 100);
}

/**
 * Rough call duration for the dashboard badge: updatedAt minus startedAt.
 * There's no explicit "call ended" timestamp, so this over-counts once a
 * session is touched again later (recap/JD generation, admin edits) —
 * acceptable for a rough badge, not exact.
 */
export function sessionDurationLabel(session: CallSession): string {
  const ms = new Date(session.updatedAt).getTime() - new Date(session.startedAt).getTime();
  const mins = Math.max(1, Math.round(ms / 60000));
  return `${mins} min${mins === 1 ? "" : "s"}`;
}
