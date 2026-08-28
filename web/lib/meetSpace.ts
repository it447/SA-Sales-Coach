/**
 * Thin client for the parts of the Google Meet REST API this tool needs:
 * turning a meeting's native (audio+video) recording on/off via
 * Space.config.artifactConfig.recordingConfig.autoRecordingGeneration. See
 * https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces
 *
 * autoRecordingGeneration only takes effect at join time (Meet checks it
 * when the organizer enters the call) -- there is no API to start/stop an
 * already-running recording. So this must be called before the rep clicks
 * "Join now", which is exactly when content-script.ts's ensureSession()
 * calls it.
 */

const MEET_API_BASE = "https://meet.googleapis.com/v2";

/** Meet codes look like "abc-defg-hij" -- 3-4-3 lowercase letters. */
const MEETING_CODE_PATTERN = /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i;

export function parseMeetingCode(meetLink: string): string | null {
  const match = meetLink.match(MEETING_CODE_PATTERN);
  return match ? match[1] : null;
}

interface MeetSpace {
  name: string; // canonical "spaces/{space}" resource name
}

/**
 * Turns Google Meet's native recording on/off for this meeting space. Only
 * works if the connected account (accessToken) is the space's organizer --
 * throws with Meet's own error message otherwise, which callers surface to
 * the rep rather than swallowing.
 */
export async function setSpaceRecording(accessToken: string, meetLink: string, enabled: boolean): Promise<void> {
  const meetingCode = parseMeetingCode(meetLink);
  if (!meetingCode) {
    throw new Error(`Couldn't parse a Google Meet code out of "${meetLink}".`);
  }

  const getRes = await fetch(`${MEET_API_BASE}/spaces/${meetingCode}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!getRes.ok) {
    throw new Error(`Meet API couldn't find this meeting space: ${await getRes.text()}`);
  }
  const space: MeetSpace = await getRes.json();

  const patchRes = await fetch(
    `${MEET_API_BASE}/${space.name}?updateMask=config.artifactConfig.recordingConfig.autoRecordingGeneration`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config: {
          artifactConfig: {
            recordingConfig: { autoRecordingGeneration: enabled ? "ON" : "OFF" },
          },
        },
      }),
    }
  );
  if (!patchRes.ok) {
    throw new Error(`Meet API couldn't update recording settings: ${await patchRes.text()}`);
  }
}
