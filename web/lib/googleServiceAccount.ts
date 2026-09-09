import { JWT } from "google-auth-library";

/**
 * Drive access for the tabCapture recording pipeline (recording-upload-session
 * and recording-destination routes) — uses a dedicated service account instead
 * of the rep's own OAuth connection (see googleMeetAuth.ts, still used by the
 * older Meet-native recording feature). This removes an entire class of
 * failure the rep-token path had: nothing here depends on a specific rep
 * having connected Google, or their token/refresh still being valid.
 *
 * The service account must be added as a Content Manager (or better) on the
 * Shared Drive folder recordings upload to — see RECORDINGS_SHARED_DRIVE_FOLDER_ID.
 * Service accounts have no personal storage quota, so this only works against
 * a real Shared Drive, not a folder living under someone's My Drive.
 */

let cachedClient: JWT | null = null;

function getClient(): JWT {
  if (cachedClient) return cachedClient;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not configured on the server.");
  }

  const key = JSON.parse(raw) as { client_email: string; private_key: string };
  cachedClient = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return cachedClient;
}

export async function getServiceAccountAccessToken(): Promise<string> {
  const client = getClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("Google didn't return an access token for the service account.");
  }
  return token;
}
