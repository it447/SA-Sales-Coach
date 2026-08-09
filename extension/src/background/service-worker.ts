/**
 * Background service worker.
 *
 * Deliberately minimal: config (API key/base URL/rep email) and the
 * meetLink -> sessionId mapping live in chrome.storage.local via
 * src/lib/storage.ts, which both the popup and content script use
 * directly — there's no need to relay reads/writes through this worker
 * for that. This file just handles extension lifecycle.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("Deal Assistant installed.");
});
