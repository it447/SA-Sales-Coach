import { getConfig, getSessionIdForMeet, setSessionIdForMeet, normalizeMeetLink } from "../lib/storage";
import * as api from "../lib/api";
import { meetingNameFromTitle } from "../lib/meetingName";
import { CaptionWatcher } from "./captions";
import { Sidebar } from "./sidebar";
import { startNativeRecordingViaUi, enableCaptionsViaUi, watchForCallJoin } from "./nativeRecording";
import type { ExtensionConfig } from "../lib/storage";
import type { GetTabRecordingStateRequest, GetTabRecordingStateResponse } from "../lib/messages";

// Shorter batch window = pricing/extraction refreshes sooner after the rep
// finishes scoping a role, at the cost of proportionally more Claude API
// calls during a live call — extraction runs on essentially every tick
// where someone's been talking, so this number directly sets call volume.
// 8s still feels live for a coaching sidebar (the rep isn't watching for
// sub-2-second updates) while cutting call count ~4x versus the original
// 2s; combined with cheaper-model + prompt-caching changes in
// lib/anthropic.ts, this is the extraction cost story end to end.
const TRANSCRIPT_BATCH_MS = 8000;
const POLL_MS = 2000;
const CAPTIONS_WARNING_DELAY_MS = 8000;

let pendingCaptionLines: string[] = [];
// Set whenever the rep wants recording on for this call, regardless of
// whether the pre-join API attempt reported success -- checked once they
// actually join, to also try the in-call "click Record meeting" fallback
// (see nativeRecording.ts). This runs unconditionally, not just when the
// API call throws: real-world testing found Google's API can report
// success (echoing back the requested config) while never actually
// recording anything, with no error surfaced at all -- so API "success"
// isn't trustworthy evidence recording will really happen. Attempting the
// UI click regardless is safe: if auto-recording genuinely did start,
// Meet's menu shows "Stop recording" at that point, not "Record meeting",
// so the text-matched click below simply won't find anything to press.
let recordingWantedForThisCall = false;

const sidebar = new Sidebar({
  onRunQuote: () =>
    withSession((config, sessionId) => api.runQuote(config, sessionId).then(applySession).catch(showError)).finally(
      () => sidebar.setBusy(false)
    ),
  onLockPrice: () =>
    withSession((config, sessionId) => api.lockPrice(config, sessionId).then(applySession).catch(showError)).finally(
      () => sidebar.setBusy(false)
    ),
  onGenerateJds: () =>
    withSession((config, sessionId) => api.generateJds(config, sessionId).then(applySession).catch(showError)).finally(
      () => sidebar.setBusy(false)
    ),
  onResolveFlag: (index) =>
    withSession(async (config, sessionId) => {
      const session = await api.getSession(config, sessionId);
      const flags = [...session.scopeFlags];
      if (!flags[index]) return;
      flags[index] = { ...flags[index], resolved: true };
      return api.saveScopeFlags(config, sessionId, flags).then(applySession).catch(showError);
    }),
  onSaveRole: (role) =>
    withSession(async (config, sessionId) => {
      const session = await api.getSession(config, sessionId);
      const roles = session.roles.map((r) => (r.id === role.id ? role : r));
      return api.saveRoles(config, sessionId, roles).then(applySession).catch(showError);
    }),
  onToggleRecording: (enabled) =>
    withSession((config, sessionId) => api.setRecording(config, sessionId, enabled).then(applySession).catch(showError)),
});

/**
 * The tabCapture recording itself can only be started/stopped from the
 * popup (see popup.ts/service-worker.ts for why) -- this just polls the
 * background worker for whether IT actually started one for this tab, so
 * the sidebar can show accurate status without being able to control it
 * directly. Runs on the same cadence as the session poll loop; cheap
 * (chrome.storage.session read), so no reason for its own timer.
 */
async function pollTabRecordingState(): Promise<void> {
  const request: GetTabRecordingStateRequest = { type: "DEAL_ASSISTANT_GET_TAB_RECORDING_STATE" };
  const response: GetTabRecordingStateResponse = await chrome.runtime.sendMessage(request);
  sidebar.setTabRecordingState(response?.isThisTabRecording ? "recording" : "idle");
}

function applySession(session: Awaited<ReturnType<typeof api.getSession>>): void {
  sidebar.update(session);
}

function showError(err: unknown): void {
  sidebar.setError(err instanceof Error ? err.message : String(err));
}

async function withSession(fn: (config: ExtensionConfig, sessionId: string) => unknown): Promise<void> {
  const config = await getConfig();
  const meetLink = normalizeMeetLink(location.href);
  const sessionId = await getSessionIdForMeet(meetLink);
  if (!config || !sessionId) return;
  await fn(config, sessionId);
}

async function pollLoop(): Promise<void> {
  await withSession(async (config, sessionId) => {
    try {
      const session = await api.getSession(config, sessionId);
      applySession(session);
    } catch (err) {
      showError(err);
    }
  });
  await pollTabRecordingState();
  setTimeout(pollLoop, POLL_MS);
}

async function flushTranscriptLoop(): Promise<void> {
  const linesToSend = pendingCaptionLines;
  pendingCaptionLines = [];

  if (linesToSend.length > 0) {
    await withSession(async (config, sessionId) => {
      try {
        // One request instead of postTranscript + runExtract + runQuote
        // separately — this loop fires every couple of seconds for the
        // whole call, so each round trip saved is latency the rep feels
        // directly. Pricing recalculates automatically as part of it
        // whenever the quote isn't locked yet, no button needed.
        const result = await api.ingestTranscript(config, sessionId, [
          { timestamp: new Date().toISOString(), speaker: null, text: linesToSend.join(" ") },
        ]);
        sidebar.setObjectionSuggestions(result.objectionSuggestions);
        applySession(result.session);
      } catch (err) {
        showError(err);
      }
    });
  }

  setTimeout(flushTranscriptLoop, TRANSCRIPT_BATCH_MS);
}

/**
 * Creates a session for this call automatically the moment the content
 * script sees a Meet page with none yet — the rep used to have to open the
 * popup and click "Start Call" for every single call, which is exactly the
 * kind of per-call manual step this tool exists to remove. Runs at the same
 * point in the page lifecycle (the pre-join screen, before "Join now" is
 * clicked) that setSpaceRecording below needs to happen at too.
 *
 * Only attempts recording for a session it JUST created — not one already
 * found in storage (e.g. the content script re-running after a page
 * refresh mid-call) — since re-patching an already-running call's
 * recording config on every reload would be pointless at best.
 */
async function ensureSession(config: ExtensionConfig): Promise<string | null> {
  const meetLink = normalizeMeetLink(location.href);
  const existing = await getSessionIdForMeet(meetLink);
  if (existing) return existing;

  try {
    const session = await api.createSession(config, meetLink, meetingNameFromTitle(document.title));
    await setSessionIdForMeet(meetLink, session.id);

    if (config.recordByDefault) {
      recordingWantedForThisCall = true;
      try {
        await api.setRecording(config, session.id, true);
      } catch (err) {
        // Recording is a bonus on top of the core transcript/pricing flow,
        // never a blocker for it — surface the problem but keep going.
        // setError (not setBanner) since watchForConfigAndSession's success
        // path below unconditionally clears the banner right after this.
        // This API path only works when the rep is the meeting's organizer
        // -- a permission failure here almost always means they aren't.
        // Either way, the in-call UI-click fallback still gets tried once
        // they join (see watchForCallJoin below) since even a reported
        // success here isn't trustworthy proof recording will really start.
        sidebar.setError(`Couldn't enable recording automatically: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return session.id;
  } catch (err) {
    sidebar.setBanner(
      `Couldn't start a session automatically (${err instanceof Error ? err.message : String(err)}) — click the extension icon to retry.`
    );
    return null;
  }
}

function watchForConfigAndSession(): void {
  const check = async () => {
    const config = await getConfig();
    if (!config) {
      sidebar.setBanner("Deal Assistant isn't configured yet — click the extension icon in your toolbar.");
      setTimeout(check, 3000);
      return;
    }

    sidebar.setDashboardBaseUrl(config.apiBaseUrl);

    const sessionId = await ensureSession(config);
    if (!sessionId) {
      setTimeout(check, 3000);
      return;
    }

    sidebar.setBanner(null);
    pollLoop();
    flushTranscriptLoop();

    // Always try to turn on Meet's own captions once the rep joins --
    // captions.ts's scraper needs them and otherwise relies on the rep
    // remembering to click "CC" themselves every call. Additionally
    // attempt the recording-menu click sequence, but only when this call
    // is one the rep wanted recorded (captured before this closure runs,
    // since recordingWantedForThisCall gets reset immediately after).
    const shouldAttemptRecording = recordingWantedForThisCall;
    recordingWantedForThisCall = false;
    watchForCallJoin(() => {
      // A short delay lets Meet's own post-join UI (toolbar, side panels)
      // finish settling before we go looking for buttons -- clicking too
      // early risks them not existing yet.
      setTimeout(async () => {
        const captionsResult = await enableCaptionsViaUi();
        if (!captionsResult.ok) {
          console.log(`[DealAssistant] couldn't auto-enable captions: ${captionsResult.reason}`);
        }

        if (!shouldAttemptRecording) return;
        const result = await startNativeRecordingViaUi();
        if (result.ok) {
          // ok here means Meet's own recording panel is now open, not
          // that recording has actually started -- the rep still needs
          // to click Meet's own "Start recording" button themselves
          // (see nativeRecording.ts for why this stops short of doing
          // that last click automatically).
          sidebar.setError(null);
          sidebar.setBanner(`${result.reason} It's open in Meet's toolbar now.`);
        } else {
          sidebar.setError(`Couldn't enable recording automatically: ${result.reason}`);
        }
      }, 2000);
    });
  };
  check();
}

function watchForCaptions(): void {
  const watcher = new CaptionWatcher((text) => {
    pendingCaptionLines.push(text);
  });
  watcher.start();

  setTimeout(() => {
    // Only surface this once there's an active session to coach on —
    // otherwise it'd fight with the "no session yet" banner for space.
    if (!watcher.hasSeenCaptions() && sidebar.hasSession()) {
      sidebar.setBanner(
        'No live captions detected. Turn on captions ("CC" button in the Meet controls) for Deal Assistant to work.'
      );
    }
  }, CAPTIONS_WARNING_DELAY_MS);
}

watchForConfigAndSession();
watchForCaptions();
