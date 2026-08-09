"use client";

/**
 * Internal manual test console — click-through the whole backend flow
 * (create session -> transcript -> extract -> quote -> lock price ->
 * generate JDs) without needing curl/Postman/terminal access. Not meant
 * for reps; this is a dev/QA tool. Safe to delete once the extension
 * (Phase 3) exercises this flow for real.
 */
import { useEffect, useState } from "react";
import { colors } from "../../lib/theme";
import { Card, Button, Badge } from "../../components/ui";

const SAMPLE_TRANSCRIPT = `Client: Hey, thanks for hopping on. So we're looking to hire someone to help with outbound sales.
Rep: Great, tell me more about what you need.
Client: We need a Sales Representative, probably mid-level, 2-4 years of experience. Should know Salesforce and be comfortable with cold calling.
Client: Budget-wise we're thinking around $2,500 to $3,000 a month.
Rep: Got it. Any preference on where the hire is based, LATAM or Africa?
Client: Honestly doesn't matter to us, whichever works.`;

interface LogEntry {
  id: number;
  label: string;
  status: number | "error";
  body: unknown;
}

export default function TestConsolePage() {
  const [apiKey, setApiKey] = useState("");
  const [meetLink, setMeetLink] = useState("https://meet.google.com/test-call");
  const [repEmail, setRepEmail] = useState("rep@scalearmy.com");
  const [transcriptText, setTranscriptText] = useState(SAMPLE_TRANSCRIPT);
  const [sessionId, setSessionId] = useState("");
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem("dealAssistantApiKey");
    if (saved) setApiKey(saved);
  }, []);

  function saveApiKey(value: string) {
    setApiKey(value);
    window.localStorage.setItem("dealAssistantApiKey", value);
  }

  async function call(label: string, path: string, options: RequestInit = {}) {
    setLoadingLabel(label);
    try {
      const res = await fetch(path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...options.headers,
        },
      });
      const body = await res.json().catch(() => ({ error: "Non-JSON response" }));
      setLog((prev) => [{ id: Date.now(), label, status: res.status, body }, ...prev]);

      if (path === "/api/sessions" && res.ok && body.id) {
        setSessionId(body.id);
      }
      return body;
    } catch (err) {
      setLog((prev) => [
        { id: Date.now(), label, status: "error", body: err instanceof Error ? err.message : String(err) },
        ...prev,
      ]);
      return null;
    } finally {
      setLoadingLabel(null);
    }
  }

  const canStep2Plus = sessionId.length > 0;
  const busy = loadingLabel !== null;

  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ color: colors.cream, fontSize: "1.5rem", marginBottom: "0.25rem" }}>
        Deal Assistant — Test Console
      </h1>
      <p style={{ color: colors.beige, fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        Internal dev tool for walking through the API flow by hand. Not part of the rep-facing product.
      </p>

      <Card title="0. API Key">
        <label style={{ display: "block", color: colors.beige, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
          INTERNAL_API_KEY (saved in your browser only)
        </label>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => saveApiKey(e.target.value)}
          placeholder="Paste your INTERNAL_API_KEY here"
          style={{
            width: "100%",
            padding: "0.75rem",
            background: colors.navyMid,
            border: `1px solid ${colors.navyBorder}`,
            borderRadius: "8px",
            color: colors.cream,
            fontSize: "0.95rem",
          }}
        />
      </Card>

      <Card title="1. Create a test session">
        <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
          <input
            value={meetLink}
            onChange={(e) => setMeetLink(e.target.value)}
            placeholder="Meet link"
            style={inputStyle}
          />
          <input
            value={repEmail}
            onChange={(e) => setRepEmail(e.target.value)}
            placeholder="Rep email"
            style={inputStyle}
          />
        </div>
        <Button
          disabled={!apiKey || busy}
          onClick={() => call("Create session", "/api/sessions", { method: "POST", body: JSON.stringify({ meetLink, repEmail }) })}
        >
          {loadingLabel === "Create session" ? "Creating…" : "Create Session"}
        </Button>
        {sessionId && (
          <div style={{ marginTop: "0.75rem" }}>
            <Badge label={`Session: ${sessionId}`} tone="success" />
          </div>
        )}
      </Card>

      <Card title="2. Post a transcript chunk">
        <textarea
          value={transcriptText}
          onChange={(e) => setTranscriptText(e.target.value)}
          rows={6}
          style={{ ...inputStyle, resize: "vertical", marginBottom: "1rem", fontFamily: "monospace" }}
        />
        <Button
          disabled={!canStep2Plus || busy}
          onClick={() =>
            call("Post transcript", `/api/sessions/${sessionId}/transcript`, {
              method: "POST",
              body: JSON.stringify({
                chunks: [{ timestamp: new Date().toISOString(), speaker: null, text: transcriptText }],
              }),
            })
          }
        >
          {loadingLabel === "Post transcript" ? "Posting…" : "Post Transcript"}
        </Button>
      </Card>

      <Card title="3-6. Run the rest of the flow">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button
            disabled={!canStep2Plus || busy}
            onClick={() => call("Extract", `/api/sessions/${sessionId}/extract`, { method: "POST" })}
          >
            3. Extract Scope
          </Button>
          <Button
            disabled={!canStep2Plus || busy}
            onClick={() => call("Quote", `/api/sessions/${sessionId}/quote`, { method: "POST" })}
          >
            4. Run Quote
          </Button>
          <Button
            disabled={!canStep2Plus || busy}
            onClick={() => call("Lock price", `/api/sessions/${sessionId}/lock-price`, { method: "POST" })}
          >
            5. Lock Price
          </Button>
          <Button
            disabled={!canStep2Plus || busy}
            onClick={() => call("Generate JDs", `/api/sessions/${sessionId}/generate-jds`, { method: "POST" })}
          >
            6. Generate JDs
          </Button>
          <Button
            variant="secondary"
            disabled={!canStep2Plus || busy}
            onClick={() => call("Refresh session", `/api/sessions/${sessionId}`, { method: "GET" })}
          >
            Refresh (GET session)
          </Button>
        </div>
      </Card>

      <Card title="Responses">
        {log.length === 0 && <p style={{ color: colors.beige, fontSize: "0.85rem" }}>Nothing yet — start with step 0 and 1 above.</p>}
        {log.map((entry) => (
          <div key={entry.id} style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <Badge
                label={`${entry.label} — ${entry.status}`}
                tone={entry.status === 200 || entry.status === 201 ? "success" : "danger"}
              />
            </div>
            <pre
              style={{
                background: colors.navy,
                border: `1px solid ${colors.navyBorder}`,
                borderRadius: "8px",
                padding: "0.75rem",
                overflowX: "auto",
                fontSize: "0.8rem",
                color: colors.cream,
                margin: 0,
              }}
            >
              {JSON.stringify(entry.body, null, 2)}
            </pre>
          </div>
        ))}
      </Card>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: "0.75rem",
  background: colors.navyMid,
  border: `1px solid ${colors.navyBorder}`,
  borderRadius: "8px",
  color: colors.cream,
  fontSize: "0.95rem",
  boxSizing: "border-box" as const,
};
