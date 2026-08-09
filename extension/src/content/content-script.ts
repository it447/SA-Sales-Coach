import { getConfig, getSessionIdForMeet, normalizeMeetLink } from "../lib/storage";
import * as api from "../lib/api";
import { CaptionWatcher } from "./captions";
import { Sidebar } from "./sidebar";
import type { ExtensionConfig } from "../lib/storage";

const TRANSCRIPT_BATCH_MS = 5000;
const POLL_MS = 5000;
const CAPTIONS_WARNING_DELAY_MS = 8000;

let pendingCaptionLines: string[] = [];

const sidebar = new Sidebar({
  onRunQuote: () => withSession((config, sessionId) => api.runQuote(config, sessionId).then(applySession).catch(showError)),
  onLockPrice: () => withSession((config, sessionId) => api.lockPrice(config, sessionId).then(applySession).catch(showError)),
  onGenerateJds: () => withSession((config, sessionId) => api.generateJds(config, sessionId).then(applySession).catch(showError)),
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
        await api.postTranscript(config, sessionId, [
          { timestamp: new Date().toISOString(), speaker: null, text: linesToSend.join(" ") },
        ]);
        const result = await api.runExtract(config, sessionId);
        applySession(result.session);
        sidebar.setObjectionSuggestions(result.objectionSuggestions);
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
