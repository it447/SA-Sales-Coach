"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { colors } from "../../lib/theme";

/**
 * Admin-only — the button is never rendered for a non-admin session (see
 * callers), but the API route re-checks admin server-side regardless since a
 * client-only check is trivially bypassable.
 */
export function DeleteSessionButton({
  sessionId,
  redirectTo,
  onDeleted,
}: {
  sessionId: string;
  redirectTo?: string;
  /** Removes this session from view immediately (see session-list.tsx) --
   * preferred over redirectTo/router.refresh() when available, since both
   * of those used to make the rep wait through the full DELETE round trip
   * (plus, for router.refresh(), a re-fetch of every other session too)
   * before anything visibly happened. */
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Permanently delete this call session? This can't be undone.")) return;

    // Instant from the rep's point of view -- the delete request below
    // still runs for real, just without making them stare at "Deleting…"
    // for it. onDeleted/redirectTo both remove this card from view (or
    // navigate away from it) right away; only the no-callback fallback
    // path still waits and shows a busy state.
    if (onDeleted) {
      onDeleted();
    } else if (redirectTo) {
      router.push(redirectTo);
    } else {
      setBusy(true);
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete session.");
      }
      if (!onDeleted && !redirectTo) router.refresh();
    } catch (err) {
      alert(
        `Delete failed: ${err instanceof Error ? err.message : String(err)}${
          onDeleted || redirectTo ? " — it may still exist; refresh to check." : ""
        }`
      );
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      style={{
        background: "transparent",
        border: `1px solid ${colors.redAccent}`,
        color: colors.redAccent,
        borderRadius: "6px",
        padding: "0.4rem 0.75rem",
        fontSize: "0.8rem",
        fontWeight: "bold",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.5 : 1,
      }}
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
