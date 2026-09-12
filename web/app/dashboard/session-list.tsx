"use client";

import { useState } from "react";
import { colors } from "../../lib/theme";
import { Card } from "../../components/ui";
import { SessionCard } from "./session-card";
import type { CallSession } from "../../lib/types";

/**
 * Client-side so a deleted card can disappear from view the instant the rep
 * clicks Delete, instead of waiting on the DELETE request's round trip plus
 * a full router.refresh() re-fetch of every session before anything visibly
 * changes -- see delete-session-button.tsx's onDeleted callback, which just
 * adds the id here rather than waiting for the server to confirm first.
 */
export function SessionList({
  groups,
  isAdmin,
}: {
  groups: { label: string; sessions: CallSession[] }[];
  isAdmin: boolean;
}) {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const markDeleted = (id: string) => setDeletedIds((prev) => new Set(prev).add(id));

  const visibleGroups = groups
    .map((group) => ({ ...group, sessions: group.sessions.filter((s) => !deletedIds.has(s.id)) }))
    .filter((group) => group.sessions.length > 0);

  if (visibleGroups.length === 0) {
    return (
      <Card>
        <p style={{ color: colors.beige }}>No calls in this time period.</p>
      </Card>
    );
  }

  return (
    <>
      {visibleGroups.map((group) => (
        <div key={group.label} style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: colors.beige, fontSize: "1rem", marginBottom: "0.75rem" }}>{group.label}</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "1rem",
            }}
          >
            {group.sessions.map((s) => (
              <SessionCard key={s.id} session={s} isAdmin={isAdmin} onDeleted={() => markDeleted(s.id)} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
