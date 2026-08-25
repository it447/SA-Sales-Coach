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
import type { ApiFetchRequest, ApiFetchResponse } from "../lib/messages";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Deal Assistant installed.");
});

chrome.runtime.onMessage.addListener((message: ApiFetchRequest, _sender, sendResponse) => {
  if (message?.type !== "DEAL_ASSISTANT_API_FETCH") return;

  handleApiFetch(message).then(sendResponse);
  return true; // keep the message channel open for the async response
});

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
