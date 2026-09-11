/**
 * Background service worker.
 *
 * Config (API key/base URL/rep email) and the meetLink -> sessionId
 * mapping live in chrome.storage.local via src/lib/storage.ts, which both
 * the popup and content script use directly.
 *
 * This file's real job: proxy every API fetch. Content-script fetches run
 * in the context of the Meet page and are subject to ITS CORS rules even
 * with host_permissions declared (host_permissions only exempts fetches
 * made from the extension's own contexts, like this background worker).
 * So src/lib/api.ts sends every request here via chrome.runtime.sendMessage
 * instead of fetching directly — see src/lib/messages.ts.
 */
import type {
  ApiFetchRequest,
  ApiFetchResponse,
  StartTabRecordingRequest,
  StopTabRecordingRequest,
  TabRecordingResponse,
  GetTabRecordingStateRequest,
  GetTabRecordingStateResponse,
  DownloadRecordingRequest,
  RecordingEndedRequest,
  LogDebugRequest,
} from "../lib/messages";
import { getRecordingTabId, setRecordingTabId } from "../lib/storage";
import { logDebug } from "../lib/debugLog";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Deal Assistant installed.");
});

type IncomingRequest =
  | ApiFetchRequest
  | StartTabRecordingRequest
  | StopTabRecordingRequest
  | GetTabRecordingStateRequest
  | DownloadRecordingRequest
  | RecordingEndedRequest
  | LogDebugRequest;

chrome.runtime.onMessage.addListener((message: IncomingRequest, sender, sendResponse) => {
  if (message?.type === "DEAL_ASSISTANT_API_FETCH") {
    handleApiFetch(message).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
  if (message?.type === "DEAL_ASSISTANT_START_TAB_RECORDING") {
    logDebug(`service worker got START_TAB_RECORDING for tab ${message.tabId}, uploadUrl ${message.uploadUrl ? "present" : "null"}`);
    startTabRecording(message.tabId, message.uploadUrl, message.sessionId).then(sendResponse);
    return true;
  }
  if (message?.type === "DEAL_ASSISTANT_STOP_TAB_RECORDING") {
    logDebug("service worker got STOP_TAB_RECORDING");
    stopTabRecording().then(sendResponse);
    return true;
  }
  if (message?.type === "DEAL_ASSISTANT_GET_TAB_RECORDING_STATE") {
    getRecordingTabId()
      .then((recordingTabId): GetTabRecordingStateResponse => ({
        isThisTabRecording: sender.tab?.id !== undefined && sender.tab.id === recordingTabId,
      }))
      .then(sendResponse);
    return true;
  }
  if (message?.type === "DEAL_ASSISTANT_DOWNLOAD_RECORDING") {
    downloadRecording(message).then(sendResponse);
    return true;
  }
  if (message?.type === "DEAL_ASSISTANT_RECORDING_ENDED") {
    markRecordingStopped().then(() => sendResponse({ success: true }));
    return true;
  }
  if (message?.type === "DEAL_ASSISTANT_LOG_DEBUG") {
    // Relayed from offscreen.ts, which has no chrome.storage of its own --
    // this background context does, so logDebug() here writes it for real
    // instead of relaying again.
    logDebug(message.message);
    return false;
  }
  return false;
});

/**
 * A toolbar-icon badge, visible regardless of which tab is focused, so a
 * rep who's not actively looking at the sidebar still has a clear,
 * persistent answer to "is this actually still recording" -- important
 * given recording can end on its own (closing the Meet tab) as well as
 * from an explicit Stop click, and the whole point is the rep shouldn't
 * have to wonder or go check.
 */
async function setRecordingBadge(active: boolean): Promise<void> {
  await chrome.action.setBadgeText({ text: active ? "REC" : "" });
  if (active) {
    await chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
  }
}

/** Shared by both ways a recording can end -- an explicit Stop click and
 * the tab capture track ending on its own (see offscreen.ts) -- so the
 * badge and recordingTabId state (which the sidebar's status text and the
 * popup's Start/Stop button both read) can never go stale regardless of
 * which one happens. */
async function markRecordingStopped(): Promise<void> {
  await setRecordingTabId(null);
  await setRecordingBadge(false);
}

/**
 * chrome.downloads is unavailable inside an offscreen document (confirmed
 * via a real "Cannot read properties of undefined (reading 'download')"
 * crash there) even though offscreen documents otherwise behave like a
 * normal extension page -- so the offscreen document builds the
 * recording and its blob: URL, and this background worker (which does
 * have full API access) does the actual save.
 */
async function downloadRecording(request: DownloadRecordingRequest): Promise<TabRecordingResponse> {
  try {
    const downloadId = await new Promise<number>((resolve, reject) => {
      chrome.downloads.download({ url: request.url, filename: request.filename, saveAs: false }, (id) => {
        if (chrome.runtime.lastError || id === undefined) {
          reject(new Error(chrome.runtime.lastError?.message ?? "Chrome didn't return a download ID."));
        } else {
          resolve(id);
        }
      });
    });
    console.log("[DealAssistant] download started, id:", downloadId);
    return { success: true };
  } catch (err) {
    console.log("[DealAssistant] download failed:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const OFFSCREEN_DOCUMENT_PATH = "dist/offscreen.html";

/**
 * chrome.tabCapture requires the caller to be an extension page (background
 * worker or offscreen document), not a content script -- and service
 * workers have no DOM/media APIs to actually record with. So this mints a
 * stream ID for the given tab, then hands it to a hidden offscreen
 * document (created on demand, reused across calls) where the real
 * capture happens, including mixing in the rep's own mic (see
 * offscreen.ts).
 *
 * tabId must come from the popup (see messages.ts) -- tabCapture itself
 * requires the user to have just invoked the extension via its toolbar
 * icon (or similar recognized gesture), which is exactly what opening the
 * popup is; a content-script-originated call fails with "Extension has
 * not been invoked for the current page" even with matching
 * host_permissions.
 */
async function startTabRecording(tabId: number, uploadUrl: string | null, sessionId: string): Promise<TabRecordingResponse> {
  try {
    await ensureOffscreenDocument();
    await logDebug("offscreen document ready, requesting tabCapture stream ID");

    const streamId = await new Promise<string>((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
        if (chrome.runtime.lastError || !id) {
          reject(new Error(chrome.runtime.lastError?.message ?? "Chrome didn't return a capture stream ID."));
        } else {
          resolve(id);
        }
      });
    });
    await logDebug("got tabCapture stream ID, forwarding OFFSCREEN_START");

    const response: TabRecordingResponse = await chrome.runtime.sendMessage({
      type: "DEAL_ASSISTANT_OFFSCREEN_START",
      streamId,
      uploadUrl,
      sessionId,
    });
    await logDebug(`OFFSCREEN_START response: ${JSON.stringify(response)}`);
    if (response?.success) {
      await setRecordingTabId(tabId);
      await setRecordingBadge(true);
    }
    return response;
  } catch (err) {
    await logDebug(`startTabRecording failed: ${err instanceof Error ? err.message : String(err)}`);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function stopTabRecording(): Promise<TabRecordingResponse> {
  try {
    const response: TabRecordingResponse = await chrome.runtime.sendMessage({ type: "DEAL_ASSISTANT_OFFSCREEN_STOP" });
    await logDebug(`OFFSCREEN_STOP response: ${JSON.stringify(response)}`);
    // markRecordingStopped() also runs when offscreen.ts's onstop fires and
    // sends DEAL_ASSISTANT_RECORDING_ENDED -- calling it again here too is
    // harmless (idempotent) and covers the case where that message
    // somehow doesn't arrive.
    await markRecordingStopped();
    return response;
  } catch (err) {
    await logDebug(`stopTabRecording failed: ${err instanceof Error ? err.message : String(err)}`);
    await markRecordingStopped();
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function ensureOffscreenDocument(): Promise<void> {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });
  if (existingContexts.length > 0) {
    await logDebug("offscreen document already exists, reusing it");
    return;
  }

  await logDebug("creating offscreen document");
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Recording the Meet call's audio and video via chrome.tabCapture.",
  });
}

async function handleApiFetch(request: ApiFetchRequest): Promise<ApiFetchResponse> {
  try {
    const res = await fetch(`${request.apiBaseUrl}${request.path}`, {
      method: request.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: request.body,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : `Request to ${request.path} failed with status ${res.status}`;
      return { success: false, error: message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
