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
}: {
  sessionId: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Permanently delete this call session? This can't be undone.")) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete session.");
      }
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
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
