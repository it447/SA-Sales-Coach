/**
 * Thin wrapper over chrome.storage.local. Usable from background, popup,
 * and content script contexts alike (all have the "storage" permission),
 * so there's no need to relay reads/writes through the background worker.
 */

export interface ExtensionConfig {
  apiBaseUrl: string;
  apiKey: string;
  repEmail: string;
}

const CONFIG_KEY = "dealAssistantConfig";
const SESSIONS_KEY = "dealAssistantSessions"; // { [meetLink]: sessionId }

export async function getConfig(): Promise<ExtensionConfig | null> {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  return result[CONFIG_KEY] ?? null;
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
