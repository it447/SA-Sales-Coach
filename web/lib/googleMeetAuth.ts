import { pool } from "./db";

/**
 * Per-rep Google OAuth for Meet recording control (Phase 2 of the
 * Fathom-replacement work) — separate from lib/authOptions.ts, which is a
 * browser session for humans viewing the dashboard. This is a raw OAuth2
 * authorization-code flow (see app/api/google/connect and
 * app/api/google/callback) because it's triggered from the extension on
 * behalf of a specific rep_email, independent of whether that rep ever
 * signs into the dashboard at all. Reuses the same GOOGLE_CLIENT_ID/SECRET
 * as the dashboard's Google Sign-In — same Cloud project, just a different
 * scope and redirect URI.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number;
}

async function requestToken(body: URLSearchParams): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Google token request failed: ${await res.text()}`);
  }
  return res.json();
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokens> {
  const data = await requestToken(
    new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    })
  );
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiryDate: Date.now() + data.expires_in * 1000,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiryDate: number }> {
  const data = await requestToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    })
  );
  return { accessToken: data.access_token, expiryDate: Date.now() + data.expires_in * 1000 };
}

export async function saveConnection(repEmail: string, tokens: GoogleTokens): Promise<void> {
  if (!tokens.refreshToken) {
    throw new Error(
      "Google didn't return a refresh token — this happens on a repeat connect without prompt=consent. Should not happen given how /api/google/connect builds its URL."
    );
  }
  await pool.query(
    `insert into google_connections (rep_email, refresh_token, access_token, token_expiry)
     values ($1, $2, $3, to_timestamp($4 / 1000.0))
     on conflict (rep_email) do update set
       refresh_token = excluded.refresh_token,
       access_token = excluded.access_token,
       token_expiry = excluded.token_expiry,
       updated_at = now()`,
    [repEmail, tokens.refreshToken, tokens.accessToken, tokens.expiryDate]
  );
}

interface ConnectionRow {
  refresh_token: string;
  access_token: string | null;
  token_expiry: Date | null;
}

/**
 * A valid (non-expired) access token for this rep's connected Google
 * account, refreshing via their stored refresh token if the cached one has
 * expired or is about to. null if they haven't connected an account yet.
 */
export async function getValidAccessToken(repEmail: string): Promise<string | null> {
  const result = await pool.query<ConnectionRow>(
    "select refresh_token, access_token, token_expiry from google_connections where rep_email = $1",
    [repEmail]
  );
  const row = result.rows[0];
  if (!row) return null;

  const stillValid = row.access_token && row.token_expiry && row.token_expiry.getTime() > Date.now() + 60_000;
  if (stillValid) return row.access_token;

  const refreshed = await refreshAccessToken(row.refresh_token);
  await pool.query(
    "update google_connections set access_token = $1, token_expiry = to_timestamp($2 / 1000.0), updated_at = now() where rep_email = $3",
    [refreshed.accessToken, refreshed.expiryDate, repEmail]
  );
  return refreshed.accessToken;
}
