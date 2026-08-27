import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/authOptions";
import { listSessions } from "../../lib/sessions";
import { colors } from "../../lib/theme";
import { Card, Badge } from "../../components/ui";
import { SignOutButton } from "./sign-out-button";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  scoping: "neutral",
  scope_flagged: "danger",
  priced: "warning",
  jd_ready: "success",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const sessions = await listSessions();

  return (
    <main style={{ maxWidth: "960px", margin: "0 auto", padding: "3rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ color: colors.cream, fontSize: "1.75rem" }}>Call Sessions</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ color: colors.beige, fontSize: "0.9rem" }}>{session?.user?.email}</span>
          <SignOutButton />
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <p style={{ color: colors.beige }}>No calls recorded yet.</p>
        </Card>
      ) : (
        sessions.map((s) => (
          <Link key={s.id} href={`/dashboard/${s.id}`} style={{ textDecoration: "none" }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: colors.cream, fontWeight: "bold", marginBottom: "0.25rem" }}>
                    {s.roles.map((r) => r.title ?? "Untitled role").join(", ") || "No roles scoped yet"}
                  </p>
                  <p style={{ color: colors.beige, fontSize: "0.85rem" }}>
                    {s.repEmail} · {new Date(s.startedAt).toLocaleString()}
                  </p>
                </div>
                <Badge label={s.status.replace("_", " ")} tone={STATUS_TONE[s.status] ?? "neutral"} />
              </div>
            </Card>
          </Link>
        ))
      )}
    </main>
  );
}
