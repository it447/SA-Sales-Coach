"use client";

import { useState } from "react";
import { colors } from "../../../lib/theme";
import { Card, Button } from "../../../components/ui";

export function SummaryPanel({ sessionId, initialSummary }: { sessionId: string; initialSummary: string | null }) {
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/summarize`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate summary.");
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Recap" accent>
      {summary ? (
        <p style={{ color: colors.beige, whiteSpace: "pre-wrap", marginBottom: "1rem" }}>{summary}</p>
      ) : (
        <p style={{ color: colors.beige, marginBottom: "1rem" }}>No recap generated yet.</p>
      )}
      {error && <p style={{ color: colors.redAccent, marginBottom: "1rem" }}>{error}</p>}
      <Button onClick={generate} disabled={loading}>
        {loading ? "Generating…" : summary ? "Regenerate recap" : "Generate recap"}
      </Button>
    </Card>
  );
}
