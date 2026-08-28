import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { exchangeCodeForTokens, saveConnection } from "../../../../lib/googleMeetAuth";

/**
 * GET /api/google/callback — where Google redirects after a rep grants (or
 * denies) Meet-recording access from /api/google/connect. Opened in a
 * regular browser tab by the rep, not read by the extension directly, so
 * this just renders a plain result page rather than returning JSON.
 */
function verifyState(state: string): string | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", process.env.INTERNAL_API_KEY ?? "").update(payload).digest("base64url");
  if (expected !== sig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof parsed.repEmail === "string" ? parsed.repEmail : null;
  } catch {
    return null;
  }
}

function resultPage(message: string, success: boolean): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><title>Deal Assistant</title></head><body style="font-family:sans-serif;padding:2rem;background:#0a1628;color:${
      success ? "#27ae60" : "#e74c3c"
    }"><p>${message}</p></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return resultPage(`Google sign-in was cancelled or denied (${error}). You can close this tab and try again.`, false);
  }
  if (!code || !state) {
    return resultPage("Missing code or state from Google's redirect.", false);
  }

  const repEmail = verifyState(state);
  if (!repEmail) {
    return resultPage("Invalid or expired request — please try connecting again from the extension popup.", false);
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    await saveConnection(repEmail, tokens);
    return resultPage(`Google account connected for ${repEmail}. You can close this tab.`, true);
  } catch (err) {
    return resultPage(
      `Failed to connect: ${err instanceof Error ? err.message : String(err)}`,
      false
    );
  }
}
