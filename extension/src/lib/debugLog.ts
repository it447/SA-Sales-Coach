/**
 * A persistent, storage-backed debug log -- console.log() requires having
 * the right DevTools window open at the exact right moment, which turned
 * out to be genuinely hard to pull off across popup.ts (transient, closes
 * on blur), offscreen.ts (invisible, only inspectable while the document
 * still exists), and the actual timing of a real recording. Every entry
 * here also still goes to console.log for whoever does have a console
 * open, but the real point is that it can be read back AFTERWARD, with no
 * timing dependency at all, via readDebugLog() -- see popup.ts's "View
 * debug log" link.
 */

const DEBUG_LOG_KEY = "dealAssistantDebugLog";
const MAX_ENTRIES = 100;

async function appendEntry(message: string): Promise<void> {
  const result = await chrome.storage.local.get(DEBUG_LOG_KEY);
  const entries: string[] = result[DEBUG_LOG_KEY] ?? [];
  entries.push(`${new Date().toISOString()} ${message}`);
  await chrome.storage.local.set({ [DEBUG_LOG_KEY]: entries.slice(-MAX_ENTRIES) });
}

/**
 * chrome.storage is undefined inside an offscreen document (confirmed via a
 * real crash there -- see messages.ts's LogDebugRequest) even though
 * offscreen documents otherwise behave like a normal extension page. Where
 * it's missing, relay the entry to the background service worker instead,
 * which does have it.
 */
export async function logDebug(message: string): Promise<void> {
  console.log(`[DealAssistant] ${message}`);
  if (chrome.storage?.local) {
    await appendEntry(message);
    return;
  }
  await chrome.runtime
    .sendMessage({ type: "DEAL_ASSISTANT_LOG_DEBUG", message })
    .catch((err) => console.log("[DealAssistant] couldn't relay debug log entry to background:", err));
}

export async function readDebugLog(): Promise<string[]> {
  const result = await chrome.storage.local.get(DEBUG_LOG_KEY);
  return result[DEBUG_LOG_KEY] ?? [];
}

export async function clearDebugLog(): Promise<void> {
  await chrome.storage.local.remove(DEBUG_LOG_KEY);
}
