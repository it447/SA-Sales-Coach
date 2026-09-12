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
  const [linkInput, setLinkInput] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

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

  // Manual fallback for whenever the automatic tabCapture-to-Drive linking
  // doesn't happen (a recording from before that existed, or a rep who
  // saved a local download and uploaded it to Drive by hand) -- so a
  // session is never permanently stuck with no way to attach a recording
  // that genuinely exists.
  const setRecordingLink = async () => {
    if (!linkInput.trim()) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/set-recording-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveLinkOrId: linkInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to link recording.");
      setDriveFileId(data.recordingDriveFileId);
      setLinkInput("");
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : String(err));
    } finally {
      setLinkBusy(false);
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

      <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${colors.navyBorder}` }}>
        <p style={{ color: colors.beige, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
          Recording not linked, or linked to the wrong file? Paste a Google Drive link (or file ID) directly:
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://drive.google.com/file/d/.../view"
            style={{
              flex: 1,
              background: colors.navy,
              border: `1px solid ${colors.navyBorder}`,
              borderRadius: "6px",
              padding: "0.4rem 0.6rem",
              color: colors.cream,
              fontSize: "0.85rem",
            }}
          />
          <Button onClick={setRecordingLink} disabled={linkBusy || !linkInput.trim()}>
            {linkBusy ? "Linking…" : "Link"}
          </Button>
        </div>
        {linkError && <p style={{ color: colors.redAccent, fontSize: "0.85rem", marginTop: "0.5rem" }}>{linkError}</p>}
      </div>
    </Card>
  );
}
