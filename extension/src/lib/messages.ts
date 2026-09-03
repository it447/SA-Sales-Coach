/**
 * Message contract between the content script/popup and the background
 * service worker for making API calls.
 *
 * WHY THIS EXISTS: fetch() calls made from a content script run in the
 * context of the page it's injected into (meet.google.com) and are
 * subject to THAT page's CORS rules, even though the extension declares
 * host_permissions for our API domain — host_permissions only exempts
 * fetches made from the extension's own contexts (background service
 * worker, popup), not from content scripts. So instead of fetching
 * directly, the content script asks the background worker to make the
 * request on its behalf.
 */

export interface ApiFetchRequest {
  type: "DEAL_ASSISTANT_API_FETCH";
  apiBaseUrl: string;
  apiKey: string;
  path: string;
  method?: string;
  body?: string;
}

export type ApiFetchResponse = { success: true; data: unknown } | { success: false; error: string };

/**
 * Content-script (sidebar button) -> background service worker: start/stop
 * capturing the Meet tab's own audio+video via chrome.tabCapture, entirely
 * independent of Meet's native recording feature (see nativeRecording.ts
 * for why that path can't work reliably for non-organizers). The actual
 * capture happens in an offscreen document (service workers have no DOM/
 * media APIs) -- the background worker's job here is just to mint a
 * tabCapture stream ID for the sender's tab and relay it there.
 */
export interface StartTabRecordingRequest {
  type: "DEAL_ASSISTANT_START_TAB_RECORDING";
}
export interface StopTabRecordingRequest {
  type: "DEAL_ASSISTANT_STOP_TAB_RECORDING";
}
export type TabRecordingResponse = { success: true } | { success: false; error: string };

/** Background service worker -> offscreen document. */
export interface OffscreenStartRequest {
  type: "DEAL_ASSISTANT_OFFSCREEN_START";
  streamId: string;
}
export interface OffscreenStopRequest {
  type: "DEAL_ASSISTANT_OFFSCREEN_STOP";
}
