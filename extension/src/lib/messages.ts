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
  /** Drive resumable-upload URL from api.ts's requestRecordingUploadUrl, or
   * null if that failed (rep hasn't connected Google, folder not
   * configured, etc.) -- offscreen.ts falls back to a local download when
   * null, rather than blocking the recording on Drive being available. */
  uploadUrl: string | null;
  /** Needed so offscreen.ts can report the finished Drive file's ID back
   * against the right session once the upload completes. */
  sessionId: string;
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
  uploadUrl: string | null;
  sessionId: string;
}
export interface OffscreenStopRequest {
  type: "DEAL_ASSISTANT_OFFSCREEN_STOP";
}

/**
 * Offscreen document -> background service worker: actually save the
 * finished recording. chrome.downloads is NOT available inside an
 * offscreen document (confirmed via a real "Cannot read properties of
 * undefined (reading 'download')" crash -- chrome.downloads itself is
 * undefined there) even though offscreen documents otherwise behave like
 * a normal extension page; the background worker has the full API
 * surface, so it does the actual download. url is a blob: URL created in
 * the offscreen document -- still fetchable from the background worker
 * since both share the same chrome-extension:// origin, as long as the
 * offscreen document (which holds the only reference keeping it alive)
 * hasn't been torn down yet.
 */
export interface DownloadRecordingRequest {
  type: "DEAL_ASSISTANT_DOWNLOAD_RECORDING";
  url: string;
  filename: string;
}

/**
 * Offscreen document -> background service worker: recording has actually
 * ended, for ANY reason -- an explicit "Stop Recording" click (which
 * already tells the background worker directly, see
 * DEAL_ASSISTANT_STOP_TAB_RECORDING) OR the tab capture track ending on
 * its own (closing/leaving the Meet tab -- see offscreen.ts). Before this
 * existed, that second path left the background worker's own
 * recordingTabId state (and so the toolbar badge and the sidebar's status
 * text) stuck on "still recording" forever after an auto-stop, since
 * nothing ever told it otherwise.
 */
export interface RecordingEndedRequest {
  type: "DEAL_ASSISTANT_RECORDING_ENDED";
}
