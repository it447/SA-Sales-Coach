"use client";

import { useState } from "react";
import { colors } from "../../../lib/theme";
import { Card, Button } from "../../../components/ui";
import type { TranscriptChunk } from "../../../lib/types";

export function TranscriptPanel({
  sessionId,
  transcript,
  initialCleanedTranscript,
}: {
  sessionId: string;
  transcript: TranscriptChunk[];
  initialCleanedTranscript: TranscriptChunk[] | null;
}) {
  const [cleaned, setCleaned] = useState(initialCleanedTranscript);
  // Defaults to showing the cleaned version once one exists -- that's the
  // whole point of asking for it -- but the raw original stays one click
  // away, never overwritten (see cleanup-transcript/route.ts).
  const [showCleaned, setShowCleaned] = useState(initialCleanedTranscript !== null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/cleanup-transcript`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to clean up transcript.");
      setCleaned(data.cleanedTranscript);
      setShowCleaned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const displayed = showCleaned && cleaned ? cleaned : transcript;

  return (
    <Card title="Full transcript">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Button onClick={cleanup} disabled={loading || transcript.length === 0}>
            {loading ? "Cleaning up…" : cleaned ? "Re-clean transcript" : "Clean up transcript"}
          </Button>
          {cleaned && (
            <button
              onClick={() => setShowCleaned(!showCleaned)}
              style={{
                background: "none",
                border: "none",
                color: colors.orange,
                fontSize: "0.85rem",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {showCleaned ? "View raw original" : "View cleaned version"}
            </button>
          )}
        </div>
      </div>
      {error && <p style={{ color: colors.redAccent, marginBottom: "0.75rem" }}>{error}</p>}
      {displayed.length === 0 ? (
        <p style={{ color: colors.beige }}>No transcript captured.</p>
      ) : (
        <div style={{ maxHeight: "500px", overflowY: "auto" }}>
          {displayed.map((chunk, i) => (
            <p key={i} style={{ color: colors.beige, fontSize: "0.85rem", marginBottom: "0.4rem" }}>
              <span style={{ color: colors.orange }}>[{chunk.timestamp}]</span> {chunk.speaker ?? "?"}: {chunk.text}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
