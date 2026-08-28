"use client";

import { useState } from "react";
import { colors } from "../../../lib/theme";
import { Card, Button } from "../../../components/ui";

export function RecordingPanel({
  sessionId,
  initialDriveFileId,
}: {
  sessionId: string;
  initialDriveFileId: string | null;
}) {
  const [driveFileId, setDriveFileId] = useState(initialDriveFileId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findRecording = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/find-recording`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to find recording.");
      setDriveFileId(data.recordingDriveFileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Recording">
      {driveFileId ? (
        <iframe
          src={`https://drive.google.com/file/d/${driveFileId}/preview`}
          allow="autoplay"
          style={{ width: "100%", aspectRatio: "16 / 9", border: "none", borderRadius: "8px", marginBottom: "1rem" }}
        />
      ) : (
        <p style={{ color: colors.beige, marginBottom: "1rem" }}>
          No recording found yet — Meet can take a while to finish processing one after the call ends.
        </p>
      )}
      {error && <p style={{ color: colors.redAccent, marginBottom: "1rem" }}>{error}</p>}
      <Button onClick={findRecording} disabled={loading}>
        {loading ? "Looking…" : driveFileId ? "Check for a newer recording" : "Find recording"}
      </Button>
    </Card>
  );
}
