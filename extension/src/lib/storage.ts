/**
 * Thin wrapper over chrome.storage.local. Usable from background, popup,
 * and content script contexts alike (all have the "storage" permission),
 * so there's no need to relay reads/writes through the background worker.
 */

export interface ExtensionConfig {
  apiBaseUrl: string;
  apiKey: string;
  repEmail: string;
  /**
   * Whether a new call should have Google Meet's native recording turned on
   * automatically. Per direction: default to recording, and the rep turns
   * it off for a specific call if the client objects — not the reverse.
   */
  recordByDefault: boolean;
}

const CONFIG_KEY = "dealAssistantConfig";
const SESSIONS_KEY = "dealAssistantSessions"; // { [meetLink]: sessionId }

export async function getConfig(): Promise<ExtensionConfig | null> {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  const config = result[CONFIG_KEY] ?? null;
  // recordByDefault didn't exist on configs saved before this field was
  // added -- default such configs to true (the standing policy) rather
  // than undefined/falsy.
  return config ? { recordByDefault: true, ...config } : null;
}

export async function setConfig(config: ExtensionConfig): Promise<void> {
  await chrome.storage.local.set({ [CONFIG_KEY]: config });
}

async function getSessionMap(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get(SESSIONS_KEY);
  return result[SESSIONS_KEY] ?? {};
}

export async function getSessionIdForMeet(meetLink: string): Promise<string | null> {
  const map = await getSessionMap();
  return map[meetLink] ?? null;
}

export async function setSessionIdForMeet(meetLink: string, sessionId: string): Promise<void> {
  const map = await getSessionMap();
  map[meetLink] = sessionId;
  await chrome.storage.local.set({ [SESSIONS_KEY]: map });
}

export async function clearSessionForMeet(meetLink: string): Promise<void> {
  const map = await getSessionMap();
  delete map[meetLink];
  await chrome.storage.local.set({ [SESSIONS_KEY]: map });
}

/** Normalizes a Meet URL to just the call ID part, ignoring query params. */
export function normalizeMeetLink(href: string): string {
  const url = new URL(href);
  return `${url.origin}${url.pathname}`;
}

// chrome.storage.session (not .local): this should never survive a full
// browser restart -- a stale "still recording" flag left over from a
// crash would be actively misleading, unlike the config/session-id state
// above which is meant to persist. Still survives the background service
// worker itself being evicted/restarted mid-call, which a plain in-memory
// variable there would not.
const RECORDING_TAB_KEY = "dealAssistantRecordingTabId";

export async function getRecordingTabId(): Promise<number | null> {
  const result = await chrome.storage.session.get(RECORDING_TAB_KEY);
  return result[RECORDING_TAB_KEY] ?? null;
}

export async function setRecordingTabId(tabId: number | null): Promise<void> {
  if (tabId === null) {
    await chrome.storage.session.remove(RECORDING_TAB_KEY);
  } else {
    await chrome.storage.session.set({ [RECORDING_TAB_KEY]: tabId });
  }
}
