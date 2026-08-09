import { NextRequest, NextResponse } from "next/server";

/**
 * Simple shared-secret auth for the internal API — the extension sends
 * `Authorization: Bearer <INTERNAL_API_KEY>` on every request. This is
 * intentionally lightweight (internal-only tool, not public-facing); swap
 * for Google Workspace SSO later if needed.
 *
 * Returns a NextResponse to send back immediately if auth fails, or null
 * if the request is authorized and the route should proceed.
 */
export function requireAuth(request: NextRequest): NextResponse | null {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "INTERNAL_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");

  if (token !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}
