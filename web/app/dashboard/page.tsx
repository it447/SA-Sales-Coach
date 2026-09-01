import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/authOptions";
import { listSessions } from "../../lib/sessions";
import { colors } from "../../lib/theme";
import { Card } from "../../components/ui";
import { ExtensionBanner } from "../../components/extension-banner";
import { SignOutButton } from "./sign-out-button";
import { SessionCard } from "./session-card";
import { PeriodFilterSelect } from "./period-filter";
import { parsePeriod, periodCutoff, groupSessionsByDay } from "../../lib/dashboardGrouping";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await getServerSession(authOptions);
  const allSessions = await listSessions();

  const period = parsePeriod(searchParams.period);
  const now = new Date();
  const cutoff = periodCutoff(period, now);
  const filtered = cutoff ? allSessions.filter((s) => new Date(s.startedAt) >= cutoff) : allSessions;
  const groups = groupSessionsByDay(filtered, now);

  return (
    <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ color: colors.cream, fontSize: "1.75rem" }}>Call Sessions</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ color: colors.beige, fontSize: "0.9rem" }}>{session?.user?.email}</span>
          <SignOutButton />
        </div>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <ExtensionBanner />
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <PeriodFilterSelect value={period} />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p style={{ color: colors.beige }}>No calls in this time period.</p>
        </Card>
      ) : (
        groups.map((group) => (
          <div key={group.label} style={{ marginBottom: "2rem" }}>
            <h2 style={{ color: colors.beige, fontSize: "1rem", marginBottom: "0.75rem" }}>{group.label}</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "1rem",
              }}
            >
              {group.sessions.map((s) => (
                <SessionCard key={s.id} session={s} isAdmin={!!session?.user?.isAdmin} />
              ))}
            </div>
          </div>
        ))
      )}
    </main>
  );
}
