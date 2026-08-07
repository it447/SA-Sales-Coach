/**
 * Background service worker.
 *
 * Phase 0 stub — Phase 3 will add: tracking the active session ID per Meet
 * tab, and reading/writing the API auth token via chrome.storage.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("Deal Assistant installed.");
});
