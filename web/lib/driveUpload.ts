/**
 * Starts a Google Drive v3 "resumable" upload session and hands back the
 * session URL the actual file bytes get PUT to. Used for the extension's
 * tabCapture recordings (see extension/src/offscreen/offscreen.ts) --
 * unlike Meet's own native recording (which always lands in the meeting
 * ORGANIZER's personal Drive, then has to be copied into the shared
 * company folder afterward, see driveCopy.ts), this uploads straight into
 * the shared folder in one step, since we control the destination
 * directly this time.
 *
 * The resumable-session URL returned here is PUT to directly from the
 * rep's browser (not routed through this Vercel deployment), so a
 * multi-hundred-MB recording never has to pass through this server's own
 * payload-size/execution-duration limits.
 */

const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3/files";

export async function createResumableUploadSession(
  accessToken: string,
  filename: string,
  folderId: string,
  mimeType: string
): Promise<string> {
  const res = await fetch(`${DRIVE_UPLOAD_BASE}?uploadType=resumable&supportsAllDrives=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
    },
    body: JSON.stringify({ name: filename, parents: [folderId] }),
  });
  if (!res.ok) {
    throw new Error(`Drive API couldn't start a resumable upload session: ${await res.text()}`);
  }

  const location = res.headers.get("Location");
  if (!location) {
    throw new Error("Drive API accepted the upload-session request but didn't return a Location header.");
  }
  return location;
}
