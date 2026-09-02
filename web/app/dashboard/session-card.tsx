import Link from "next/link";
import { colors } from "../../lib/theme";
import { Badge } from "../../components/ui";
import { sessionTitle, scopeCompletionPercent, sessionDurationLabel } from "../../lib/sessions";
import type { CallSession } from "../../lib/types";
import { DeleteSessionButton } from "./delete-session-button";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  scoping: "neutral",
  scope_flagged: "danger",
  priced: "warning",
  jd_ready: "success",
};

function initials(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}

function completionTone(pct: number): "danger" | "warning" | "success" {
  if (pct < 40) return "danger";
  if (pct < 80) return "warning";
  return "success";
}

/** The two-tone thumbnail row: a real Drive-generated preview once a recording's been found, else initials placeholders for the rep and the call itself. */
function Thumbnail({ session }: { session: CallSession }) {
  if (session.recordingDriveFileId) {
    return (
      // Relies on the viewer being signed into a Google account with Shared
      // Drive access in the same browser (same assumption the session
      // detail page's embedded Drive preview iframe already makes) --
      // next/image would proxy this through Vercel's server instead of the
      // viewer's browser, losing that Google session cookie entirely.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://drive.google.com/thumbnail?id=${session.recordingDriveFileId}&sz=w400`}
        alt=""
        style={{
          width: "100%",
          height: "110px",
          objectFit: "cover",
          borderRadius: "8px",
          display: "block",
        }}
      />
    );
  }

  return (
    <div style={{ display: "flex", height: "110px", borderRadius: "8px", overflow: "hidden" }}>
      <div
        style={{
          flex: 1,
          background: colors.navyMid,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.orange,
          fontWeight: "bold",
          fontSize: "1.5rem",
        }}
      >
        {initials(session.repEmail.split("@")[0].replace(/[._]/g, " "))}
      </div>
      <div
        style={{
          flex: 1,
          background: colors.navyBorder,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.beige,
          fontWeight: "bold",
          fontSize: "1.5rem",
        }}
      >
        {initials(sessionTitle(session))}
      </div>
    </div>
  );
}

export function SessionCard({ session, isAdmin }: { session: CallSession; isAdmin: boolean }) {
  const pct = scopeCompletionPercent(session);

  return (
    <Link href={`/dashboard/${session.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: colors.navyLight,
          border: `1px solid ${colors.navyBorder}`,
          borderRadius: "16px",
          padding: "0.75rem",
          height: "100%",
        }}
      >
        <div style={{ position: "relative" }}>
          <Thumbnail session={session} />
          <div style={{ position: "absolute", top: "0.5rem", left: "0.5rem" }}>
            <Badge label={`${pct}%`} tone={completionTone(pct)} />
          </div>
          <div
            style={{
              position: "absolute",
              bottom: "0.5rem",
              right: "0.5rem",
              background: "rgba(10, 22, 40, 0.85)",
              color: colors.cream,
              fontSize: "0.75rem",
              fontWeight: "bold",
              padding: "0.2rem 0.5rem",
              borderRadius: "6px",
            }}
          >
            {sessionDurationLabel(session)}
          </div>
        </div>

        <p
          style={{
            color: colors.cream,
            fontWeight: "bold",
            marginTop: "0.75rem",
            marginBottom: "0.25rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sessionTitle(session)}
        </p>
        <p style={{ color: colors.beige, fontSize: "0.8rem", marginBottom: "0.5rem" }}>{session.repEmail}</p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Badge label={session.status.replace("_", " ")} tone={STATUS_TONE[session.status] ?? "neutral"} />
          {isAdmin && <DeleteSessionButton sessionId={session.id} />}
        </div>
      </div>
    </Link>
  );
}
