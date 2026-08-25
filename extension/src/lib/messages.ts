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
