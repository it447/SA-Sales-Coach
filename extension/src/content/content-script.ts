import { getConfig, getSessionIdForMeet, normalizeMeetLink } from "../lib/storage";
import * as api from "../lib/api";
import { CaptionWatcher } from "./captions";
import { Sidebar } from "./sidebar";
import type { ExtensionConfig } from "../lib/storage";

// Shorter batch window = pricing/extraction refreshes sooner after the rep
// finishes scoping a role, at the cost of ~2.5x more Claude API calls during
// a live call — a fine trade for a real-time coaching tool at our call volume.
const TRANSCRIPT_BATCH_MS = 2000;
const POLL_MS = 2000;
const CAPTIONS_WARNING_DELAY_MS = 8000;

let pendingCaptionLines: string[] = [];

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
});

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

function watchForConfigAndSession(): void {
  const check = async () => {
    const config = await getConfig();
    if (!config) {
      sidebar.setBanner("Deal Assistant isn't configured yet — click the extension icon in your toolbar.");
      setTimeout(check, 3000);
      return;
    }

    const meetLink = normalizeMeetLink(location.href);
    const sessionId = await getSessionIdForMeet(meetLink);
    if (!sessionId) {
      sidebar.setBanner("No active session for this call — click the extension icon to start one.");
      setTimeout(check, 3000);
      return;
    }

    sidebar.setBanner(null);
    pollLoop();
    flushTranscriptLoop();
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
