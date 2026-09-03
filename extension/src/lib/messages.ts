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
 * Popup -> background service worker: start/stop capturing a Meet tab's own
 * audio+video via chrome.tabCapture, entirely independent of Meet's native
 * recording feature (see nativeRecording.ts for why that path can't work
 * reliably for non-organizers). The actual capture happens in an offscreen
 * document (service workers have no DOM/media APIs) -- the background
 * worker's job here is just to mint a tabCapture stream ID for the given
 * tab and relay it there.
 *
 * MUST originate from the popup, not the in-page sidebar: Chrome only
 * grants an extension tabCapture access after the user invokes the
 * extension through one of a few recognized gestures (its toolbar icon,
 * a keyboard command, a context-menu item) -- clicking a button the
 * extension injected into the page does NOT count, and tabCapture fails
 * with "Extension has not been invoked for the current page" if tried
 * from there. tabId is explicit (rather than inferred from the sender)
 * because the popup itself isn't associated with any one tab -- it
 * queries the active tab itself and passes that id along.
 */
export interface StartTabRecordingRequest {
  type: "DEAL_ASSISTANT_START_TAB_RECORDING";
  tabId: number;
}
export interface StopTabRecordingRequest {
  type: "DEAL_ASSISTANT_STOP_TAB_RECORDING";
}
export type TabRecordingResponse = { success: true } | { success: false; error: string };

/** Content script (sidebar) -> background: read-only status check, since
 * only the popup can actually start/stop a recording (see above). */
export interface GetTabRecordingStateRequest {
  type: "DEAL_ASSISTANT_GET_TAB_RECORDING_STATE";
}
export type GetTabRecordingStateResponse = { isThisTabRecording: boolean };

/** Background service worker -> offscreen document. */
export interface OffscreenStartRequest {
  type: "DEAL_ASSISTANT_OFFSCREEN_START";
  streamId: string;
}
export interface OffscreenStopRequest {
  type: "DEAL_ASSISTANT_OFFSCREEN_STOP";
}
