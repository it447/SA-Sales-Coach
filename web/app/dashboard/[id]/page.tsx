import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import { getSession, sessionTitle } from "../../../lib/sessions";
import { describeSalaryAdjustment } from "../../../lib/pricing";
import { colors } from "../../../lib/theme";
import { Card, Badge } from "../../../components/ui";
import { SummaryPanel } from "./summary-panel";
import { DeleteSessionButton } from "../delete-session-button";

function money(n: number | null): string {
  return typeof n === "number" ? `$${n.toLocaleString()}` : "—";
}

export default async function SessionDetailPage({ params }: { params: { id: string } }) {
  const authSession = await getServerSession(authOptions);
  const session = await getSession(params.id);
  if (!session) notFound();

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "3rem 1.5rem" }}>
      <Link href="/dashboard" style={{ color: colors.orange, fontSize: "0.9rem" }}>
        ← All sessions
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "1rem 0 2rem" }}>
        <div>
          <h1 style={{ color: colors.cream, fontSize: "1.5rem" }}>{sessionTitle(session)}</h1>
          <p style={{ color: colors.beige, fontSize: "0.9rem" }}>
            {session.repEmail} · {new Date(session.startedAt).toLocaleString()}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Badge label={session.status.replace("_", " ")} />
          {authSession?.user?.isAdmin && <DeleteSessionButton sessionId={session.id} redirectTo="/dashboard" />}
        </div>
      </div>

      <SummaryPanel sessionId={session.id} initialSummary={session.summary} />

      <Card title="Roles">
        {session.roles.length === 0 ? (
          <p style={{ color: colors.beige }}>No roles scoped.</p>
        ) : (
          session.roles.map((role) => (
            <div key={role.id} style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: `1px solid ${colors.navyBorder}` }}>
              <p style={{ color: colors.cream, fontWeight: "bold" }}>{role.title ?? "Untitled role"}</p>
              <p style={{ color: colors.beige, fontSize: "0.9rem" }}>
                {role.seniority ?? "Seniority unknown"} · {role.region ?? "Region unknown"}
              </p>
              {role.mustHaves.length > 0 && (
                <p style={{ color: colors.beige, fontSize: "0.9rem" }}>Must-haves: {role.mustHaves.join(", ")}</p>
              )}
              {typeof role.clientBudget === "number" && (
                <p style={{ color: colors.beige, fontSize: "0.9rem" }}>Client budget: {money(role.clientBudget)}/mo</p>
              )}
              {describeSalaryAdjustment(role) && (
                <p style={{ color: colors.beige, fontSize: "0.9rem" }}>Cost premium: {describeSalaryAdjustment(role)}</p>
              )}
              {role.isTechRole && (
                <>
                  <p style={{ color: colors.beige, fontSize: "0.9rem" }}>
                    First task: {role.firstTask ?? <span style={{ color: colors.redAccent }}>not answered</span>}
                  </p>
                  <p style={{ color: colors.beige, fontSize: "0.9rem" }}>
                    Success outcome: {role.successOutcome ?? <span style={{ color: colors.redAccent }}>not answered</span>}
                  </p>
                </>
              )}
            </div>
          ))
        )}
      </Card>

      <Card title="Quote">
        <p style={{ color: colors.beige }}>
          Final price: {money(session.quote.finalPrice)} · Margin:{" "}
          {typeof session.quote.marginPct === "number" ? `${(session.quote.marginPct * 100).toFixed(1)}%` : "—"} · Tier:{" "}
          {session.quote.tier ?? "—"}
        </p>
        <p style={{ color: colors.beige, fontSize: "0.85rem", marginTop: "0.5rem" }}>
          Priced {session.quote.pricedRoleCount} of {session.quote.totalRoleCount} roles
          {session.quote.lockedAt ? ` · Locked ${new Date(session.quote.lockedAt).toLocaleString()}` : " · Not locked"}
        </p>
      </Card>

      {session.scopeFlags.some((f) => !f.resolved) && (
        <Card title="Open flags">
          {session.scopeFlags
            .filter((f) => !f.resolved)
            .map((f, i) => (
              <p key={i} style={{ color: f.severity === "critical" ? colors.redAccent : colors.yellowAccent, marginBottom: "0.5rem" }}>
                {f.message}
              </p>
            ))}
        </Card>
      )}

      {session.jds.length > 0 && (
        <Card title="Job Descriptions">
          {session.jds.map((jd) => {
            const role = session.roles.find((r) => r.id === jd.roleId);
            return (
              <details key={jd.roleId} style={{ marginBottom: "0.75rem" }}>
                <summary style={{ color: colors.cream, cursor: "pointer" }}>{role?.title ?? jd.roleId}</summary>
                <pre style={{ whiteSpace: "pre-wrap", color: colors.beige, fontFamily: "inherit", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                  {jd.content}
                </pre>
              </details>
            );
          })}
        </Card>
      )}

      <Card title="Full transcript">
        {session.transcript.length === 0 ? (
          <p style={{ color: colors.beige }}>No transcript captured.</p>
        ) : (
          <div style={{ maxHeight: "500px", overflowY: "auto" }}>
            {session.transcript.map((chunk, i) => (
              <p key={i} style={{ color: colors.beige, fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                <span style={{ color: colors.orange }}>[{chunk.timestamp}]</span> {chunk.speaker ?? "?"}: {chunk.text}
              </p>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
