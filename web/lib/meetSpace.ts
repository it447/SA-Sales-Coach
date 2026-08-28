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

async function getSpace(accessToken: string, meetLink: string): Promise<MeetSpace> {
  const meetingCode = parseMeetingCode(meetLink);
  if (!meetingCode) {
    throw new Error(`Couldn't parse a Google Meet code out of "${meetLink}".`);
  }

  const res = await fetch(`${MEET_API_BASE}/spaces/${meetingCode}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Meet API couldn't find this meeting space: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Turns Google Meet's native recording on/off for this meeting space. Only
 * works if the connected account (accessToken) is the space's organizer --
 * throws with Meet's own error message otherwise, which callers surface to
 * the rep rather than swallowing.
 */
export async function setSpaceRecording(accessToken: string, meetLink: string, enabled: boolean): Promise<void> {
  const space = await getSpace(accessToken, meetLink);

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

interface ConferenceRecord {
  name: string; // "conferenceRecords/{id}"
  startTime?: string;
}

interface Recording {
  driveDestination?: { file?: string };
}

/**
 * The Drive file ID of the most recent finished recording for this meeting
 * space, or null if none is found yet (Meet can take a while after a call
 * ends to finish processing a recording -- this is meant to be called on
 * demand, e.g. a "Find recording" button, not right after the call ends).
 *
 * Picks the most recently STARTED conference record for the space, on the
 * assumption that whoever's looking is checking on a call that just
 * happened -- a meeting space with a persistent code can be reused across
 * many unrelated calls over time, so this isn't reliable for anything but
 * "the last call held in this space."
 */
export async function getLatestRecordingFileId(accessToken: string, meetLink: string): Promise<string | null> {
  const space = await getSpace(accessToken, meetLink);

  const recordsUrl = new URL(`${MEET_API_BASE}/conferenceRecords`);
  recordsUrl.searchParams.set("filter", `space.name = "${space.name}"`);
  const recordsRes = await fetch(recordsUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!recordsRes.ok) {
    throw new Error(`Meet API couldn't list conference records: ${await recordsRes.text()}`);
  }
  const { conferenceRecords }: { conferenceRecords?: ConferenceRecord[] } = await recordsRes.json();
  if (!conferenceRecords || conferenceRecords.length === 0) return null;

  const latest = conferenceRecords.reduce((newest, record) =>
    (record.startTime ?? "") > (newest.startTime ?? "") ? record : newest
  );

  const recordingsRes = await fetch(`${MEET_API_BASE}/${latest.name}/recordings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!recordingsRes.ok) {
    throw new Error(`Meet API couldn't list recordings: ${await recordingsRes.text()}`);
  }
  const { recordings }: { recordings?: Recording[] } = await recordingsRes.json();
  const fileId = recordings?.[0]?.driveDestination?.file;
  return fileId ?? null;
}
