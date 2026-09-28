import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authOptions";

/**
 * GET /api/google/connect — visiting this URL directly grants Meet-
 * recording control over the visitor's own Google account. Redirects
 * straight to Google's consent screen; app/api/google/callback handles
 * the return trip. Nothing in the app currently links here (the
 * extension's old "Connect Google Account" button was removed, since
 * tabCapture recording covers most calls without it) -- this stays live
 * for the "Find recording" dashboard fallback, which still needs a rep's
 * Google connection to work.
 *
 * Gated by the dashboard's own Google login (authOptions), which already
 * restricts sign-in to @scalearmy.com accounts -- repEmail is read from
 * THAT verified session, never from a client-supplied query param. This
 * used to accept `?repEmail=` directly from the URL with no auth at all,
 * which meant anyone (no login, no API key) could complete Google's
 * consent flow with their OWN Google account and have saveConnection()
 * silently overwrite a real rep's stored refresh/access token just by
 * guessing their @scalearmy.com address -- a full account-hijack with no
 * prerequisite beyond knowing the email format.
 *
 * meetings.space.settings (turn recording on) and meetings.space.readonly
 * (list conference records / find the recording afterward) are both
 * non-sensitive scopes (confirmed against Google's own scope
 * documentation), so this doesn't need Google's app verification process,
 * and doesn't need Workspace domain-wide delegation -- each rep grants it
 * individually for their own account.
 *
 * The Drive scope is needed to copy a finished recording (which Meet always
 * saves to the REP's own Drive -- there's no way to redirect that) into the
 * shared company Drive folder the dashboard reads from, so a recording
 * isn't lost or stuck behind one person's account if they leave. It's a
 * RESTRICTED scope, which normally means Google's formal app-verification
 * process -- but this project's OAuth consent screen is "Internal" (Google
 * Cloud Console -> APIs & Services -> Audience), meaning it's confined to
 * this Workspace org, and Internal apps skip that verification entirely
 * regardless of scope sensitivity. If this project's audience is ever
 * switched to External, this scope needs Google's review before it works.
 */
const SCOPE =
  "https://www.googleapis.com/auth/meetings.space.settings https://www.googleapis.com/auth/meetings.space.readonly https://www.googleapis.com/auth/drive openid email";

function signState(repEmail: string): string {
  const payload = Buffer.from(JSON.stringify({ repEmail, nonce: crypto.randomBytes(8).toString("hex") })).toString(
    "base64url"
  );
  const sig = crypto.createHmac("sha256", process.env.INTERNAL_API_KEY ?? "").update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const repEmail = session?.user?.email;
  if (!repEmail) {
    return NextResponse.json({ error: "You must be signed in to connect a Google account." }, { status: 401 });
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/google/callback`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  // Both required to guarantee a refresh_token comes back, including on a
  // reconnect (Google only issues one on the FIRST consent otherwise).
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", signState(repEmail));

  return NextResponse.redirect(url.toString());
}
