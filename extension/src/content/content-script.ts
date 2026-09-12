import { getConfig, getSessionIdForMeet, setSessionIdForMeet, normalizeMeetLink } from "../lib/storage";
import * as api from "../lib/api";
import { meetingNameFromTitle } from "../lib/meetingName";
import { CaptionWatcher } from "./captions";
import { Sidebar } from "./sidebar";
import { enableCaptionsViaUi, watchForCallJoin } from "./nativeRecording";
import type { ExtensionConfig } from "../lib/storage";
import type { GetTabRecordingStateRequest, GetTabRecordingStateResponse, StopTabRecordingRequest } from "../lib/messages";

// Tiered extraction cadence: most of a call's early minutes are
// agenda-setting/discovery, where the rep isn't waiting on live pricing or
// objection-handling help — a slower, cheaper cadence there costs nothing
// in practice. Once role scoping actually starts (see fastCadenceActive
// below), the sidebar's live suggestions matter a lot more (pricing
// pushback, objections, closing), so extraction switches to a faster
// cadence for the rest of the call. Sticky forward-only, same philosophy
// as CallPhases — a call doesn't go back to "just discovery" once roles
// are being scoped.
const SLOW_TRANSCRIPT_BATCH_MS = 20000;
const FAST_TRANSCRIPT_BATCH_MS = 8000;
const POLL_MS = 2000;
const CAPTIONS_WARNING_DELAY_MS = 8000;

let pendingCaptionLines: string[] = [];
let fastCadenceActive = false;

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
  // Re-runs the quote right after saving -- lets an AE fix a below-budget
  // role themselves (e.g. drop to a lower seniority, or open up region)
  // and see the updated price immediately, instead of waiting for the
  // next live extraction tick to notice the same change in the transcript
  // (it might not, if the client never actually restates it out loud).
  onSaveRole: (role) =>
    withSession(async (config, sessionId) => {
      const session = await api.getSession(config, sessionId);
      const roles = session.roles.map((r) => (r.id === role.id ? role : r));
      await api.saveRoles(config, sessionId, roles);
      return api.runQuote(config, sessionId).then(applySession).catch(showError);
    }),
  // Sets this role's title to the catalog title Claude suggested (see
  // quoting.ts's addSuggestedMatches), then re-runs the quote so it prices
  // immediately -- the title now matches pricing_data exactly, so this is
  // just the normal exact-match path, no further AI involved.
  onConfirmRoleMatch: (roleId, matchedTitle) =>
    withSession(async (config, sessionId) => {
      const session = await api.getSession(config, sessionId);
      const roles = session.roles.map((r) => (r.id === roleId ? { ...r, title: matchedTitle } : r));
      await api.saveRoles(config, sessionId, roles);
      return api.runQuote(config, sessionId).then(applySession).catch(showError);
    }),
  // Stopping tabCapture has no gesture requirement (unlike starting it),
  // so this can be sent straight from the sidebar -- see popup.ts/
  // service-worker.ts for why starting can't work the same way.
  onStopRecording: () => {
    const request: StopTabRecordingRequest = { type: "DEAL_ASSISTANT_STOP_TAB_RECORDING" };
    chrome.runtime.sendMessage(request).catch((err: unknown) => showError(err));
  },
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
  // Role scoping isn't its own CallPhases flag (see types.ts) — it's judged
  // from roles' presence directly, so that's the same signal this uses to
  // switch extraction cadence.
  fastCadenceActive = fastCadenceActive || session.roles.length > 0;
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

  setTimeout(flushTranscriptLoop, fastCadenceActive ? FAST_TRANSCRIPT_BATCH_MS : SLOW_TRANSCRIPT_BATCH_MS);
}

/**
 * Creates a session for this call automatically the moment the content
 * script sees a Meet page with none yet — the rep used to have to open the
 * popup and click "Start Call" for every single call, which is exactly the
 * kind of per-call manual step this tool exists to remove.
 *
 * Recording itself is handled separately via chrome.tabCapture, started
 * from the extension's popup (see popup.ts/service-worker.ts) rather than
 * anything automatic here — Meet's own native recording (both its REST
 * API and an in-call menu click) is organizer-only, a hard Google-side
 * restriction that made it unreliable for most real calls, which reps
 * usually join rather than organize.
 */
async function ensureSession(config: ExtensionConfig): Promise<string | null> {
  const meetLink = normalizeMeetLink(location.href);
  const existing = await getSessionIdForMeet(meetLink);
  if (existing) return existing;

  try {
    const session = await api.createSession(config, meetLink, meetingNameFromTitle(document.title));
    await setSessionIdForMeet(meetLink, session.id);
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

    // Turn on Meet's own captions once the rep joins -- captions.ts's
    // scraper needs them and otherwise relies on the rep remembering to
    // click "CC" themselves every call.
    watchForCallJoin(() => {
      // A short delay lets Meet's own post-join UI (toolbar, side panels)
      // finish settling before we go looking for the button -- clicking
      // too early risks it not existing yet.
      setTimeout(async () => {
        const captionsResult = await enableCaptionsViaUi();
        if (!captionsResult.ok) {
          console.log(`[DealAssistant] couldn't auto-enable captions: ${captionsResult.reason}`);
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
