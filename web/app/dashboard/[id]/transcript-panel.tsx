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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Only the cleaned transcript is ever shown once one exists -- the raw
  // caption-scrape version stays in `transcript` untouched in the DB (see
  // cleanup-transcript/route.ts) but isn't surfaced here anymore.
  const displayed = cleaned ?? transcript;

  return (
    <Card title="Full transcript">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <Button onClick={cleanup} disabled={loading || transcript.length === 0}>
          {loading ? "Cleaning up…" : cleaned ? "Re-clean transcript" : "Clean up transcript"}
        </Button>
      </div>
      {error && <p style={{ color: colors.redAccent, marginBottom: "0.75rem" }}>{error}</p>}
      {displayed.length === 0 ? (
        <p style={{ color: colors.beige }}>No transcript captured.</p>
      ) : (
        <div style={{ maxHeight: "500px", overflowY: "auto" }}>
          {displayed.map((chunk, i) => (
            <p key={i} style={{ color: colors.beige, fontSize: "0.85rem", marginBottom: "0.4rem" }}>
              <span style={{ fontWeight: "bold" }}>{chunk.speaker ?? "?"}:</span> {chunk.text}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
