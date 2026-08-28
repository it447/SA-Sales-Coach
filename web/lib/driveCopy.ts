/**
 * Copies a Meet recording (which always lands in the meeting organizer's
 * own personal Drive -- Meet has no setting to redirect this) into a
 * company-owned Shared Drive folder, so it's not tied to any one rep's
 * account (and isn't lost if they ever leave). The copying account (the
 * rep's connected Google account) needs at least Content Manager access to
 * the destination Shared Drive folder -- a one-time membership setup, not
 * something this code can grant.
 */

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

interface DriveFile {
  id: string;
}

export async function copyFileToSharedFolder(accessToken: string, fileId: string, folderId: string): Promise<string> {
  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}/copy?supportsAllDrives=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parents: [folderId] }),
  });
  if (!res.ok) {
    throw new Error(`Drive API couldn't copy the recording: ${await res.text()}`);
  }
  const copied: DriveFile = await res.json();
  return copied.id;
}
