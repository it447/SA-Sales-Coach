import { colors } from "../../../lib/theme";
import { Card, Badge } from "../../../components/ui";
import type { CallScorecard } from "../../../lib/types";

function scoreBand(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.8) return colors.greenAccent;
  if (pct >= 0.5) return colors.yellowAccent;
  return colors.redAccent;
}

function sqlTone(status: string): "success" | "warning" | "danger" {
  if (status === "Yes") return "success";
  if (status === "Unclear") return "warning";
  return "danger";
}

/**
 * Read-only — the scorecard is generated automatically right after the
 * transcript cleanup finishes (see cleanup-transcript/route.ts), scored
 * against config/scorecard-rubric.md. Nothing to trigger from here; if it's
 * null, scoring either hasn't run yet or the call has no transcript.
 */
export function ScorecardPanel({ scorecard }: { scorecard: CallScorecard | null }) {
  if (!scorecard) return null;
  const { result } = scorecard;
  const passed = result.overall_score >= result.pass_threshold;

  return (
    <Card title="Call Scorecard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <p style={{ color: colors.cream, fontSize: "1.5rem", fontWeight: "bold" }}>
            {result.overall_score} / {result.max_score}
            {result.total_max_score !== result.max_score && (
              <span style={{ color: colors.beige, fontSize: "0.9rem", fontWeight: "normal" }}>
                {" "}
                ({result.total_max_score} incl. reviewer-scored)
              </span>
            )}
          </p>
          <p style={{ color: colors.beige, fontSize: "0.85rem" }}>Pass mark: {result.pass_threshold}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Badge label={passed ? "pass" : "below pass mark"} tone={passed ? "success" : "warning"} />
          <Badge label={`SQL: ${result.sql.status}`} tone={sqlTone(result.sql.status)} />
        </div>
      </div>

      <p style={{ color: colors.beige, fontSize: "0.9rem", marginBottom: "1rem" }}>{result.sql.summary}</p>

      <div style={{ marginBottom: "1rem" }}>
        {result.categories.map((c) => (
          <div key={c.key} style={{ marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: `1px solid ${colors.navyBorder}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: colors.cream, fontWeight: "bold" }}>{c.name}</span>
              <span style={{ color: scoreBand(c.score, c.max), fontWeight: "bold" }}>
                {c.score} / {c.max}
              </span>
            </div>
            <p style={{ color: colors.beige, fontSize: "0.85rem", marginTop: "0.25rem" }}>{c.summary}</p>
          </div>
        ))}
      </div>

      {result.flags.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <p style={{ color: colors.redAccent, fontWeight: "bold", fontSize: "0.9rem", marginBottom: "0.25rem" }}>🚩 Flags</p>
          <ul style={{ color: colors.beige, fontSize: "0.85rem", margin: 0, paddingLeft: "1.25rem" }}>
            {result.flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <p style={{ color: colors.orange, fontWeight: "bold", fontSize: "0.9rem", marginBottom: "0.25rem" }}>Coaching focus</p>
        <p style={{ color: colors.beige, fontSize: "0.9rem" }}>{result.coaching_focus}</p>
      </div>

      <details>
        <summary style={{ color: colors.orange, cursor: "pointer", fontSize: "0.9rem" }}>
          Full detail (objections, went well, needs improvement)
        </summary>
        <div style={{ marginTop: "0.75rem" }}>
          {result.objection_details.length > 0 && (
            <div style={{ marginBottom: "0.75rem" }}>
              <p style={{ color: colors.cream, fontWeight: "bold", fontSize: "0.85rem" }}>Objections</p>
              {result.objection_details.map((o, i) => (
                <p key={i} style={{ color: colors.beige, fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  <strong>{o.objection}</strong> — {o.rating} ({o.formula_attempted}): {o.reason}
                </p>
              ))}
            </div>
          )}
          {result.went_well.length > 0 && (
            <div style={{ marginBottom: "0.75rem" }}>
              <p style={{ color: colors.greenAccent, fontWeight: "bold", fontSize: "0.85rem" }}>Went well</p>
              <ul style={{ color: colors.beige, fontSize: "0.85rem", margin: 0, paddingLeft: "1.25rem" }}>
                {result.went_well.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {result.needs_improvement.length > 0 && (
            <div>
              <p style={{ color: colors.yellowAccent, fontWeight: "bold", fontSize: "0.85rem" }}>Needs improvement</p>
              <ul style={{ color: colors.beige, fontSize: "0.85rem", margin: 0, paddingLeft: "1.25rem" }}>
                {result.needs_improvement.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}
