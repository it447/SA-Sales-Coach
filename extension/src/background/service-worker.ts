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
} from "../lib/messages";
import { getRecordingTabId, setRecordingTabId } from "../lib/storage";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Deal Assistant installed.");
});

type IncomingRequest = ApiFetchRequest | StartTabRecordingRequest | StopTabRecordingRequest | GetTabRecordingStateRequest;

chrome.runtime.onMessage.addListener((message: IncomingRequest, sender, sendResponse) => {
  if (message?.type === "DEAL_ASSISTANT_API_FETCH") {
    handleApiFetch(message).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
  if (message?.type === "DEAL_ASSISTANT_START_TAB_RECORDING") {
    startTabRecording(message.tabId).then(sendResponse);
    return true;
  }
  if (message?.type === "DEAL_ASSISTANT_STOP_TAB_RECORDING") {
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
  return false;
});

const OFFSCREEN_DOCUMENT_PATH = "dist/offscreen.html";

/**
 * chrome.tabCapture requires the caller to be an extension page (background
 * worker or offscreen document), not a content script -- and service
 * workers have no DOM/media APIs to actually record with. So this mints a
 * stream ID for the given tab, then hands it to a hidden offscreen
 * document (created on demand, reused across calls) where the real
 * capture happens. See offscreen.ts for why this only captures the tab's
 * own audio/video (not the rep's own mic) for now.
 *
 * tabId must come from the popup (see messages.ts) -- tabCapture itself
 * requires the user to have just invoked the extension via its toolbar
 * icon (or similar recognized gesture), which is exactly what opening the
 * popup is; a content-script-originated call fails with "Extension has
 * not been invoked for the current page" even with matching
 * host_permissions.
 */
async function startTabRecording(tabId: number): Promise<TabRecordingResponse> {
  try {
    await ensureOffscreenDocument();

    const streamId = await new Promise<string>((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
        if (chrome.runtime.lastError || !id) {
          reject(new Error(chrome.runtime.lastError?.message ?? "Chrome didn't return a capture stream ID."));
        } else {
          resolve(id);
        }
      });
    });

    const response: TabRecordingResponse = await chrome.runtime.sendMessage({
      type: "DEAL_ASSISTANT_OFFSCREEN_START",
      streamId,
    });
    if (response?.success) {
      await setRecordingTabId(tabId);
    }
    return response;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function stopTabRecording(): Promise<TabRecordingResponse> {
  try {
    const response: TabRecordingResponse = await chrome.runtime.sendMessage({ type: "DEAL_ASSISTANT_OFFSCREEN_STOP" });
    await setRecordingTabId(null); // clear regardless of response -- nothing to recover into if the stop itself half-failed
    return response;
  } catch (err) {
    await setRecordingTabId(null);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function ensureOffscreenDocument(): Promise<void> {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });
  if (existingContexts.length > 0) return;

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
