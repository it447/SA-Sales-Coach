import type { ExtensionConfig } from "./storage";
import type { CallSession, RoleScope, ScopeFlag, TranscriptChunk } from "../types";
import type { ApiFetchRequest, ApiFetchResponse } from "./messages";

export class ApiError extends Error {}

/**
 * Routes every API call through the background service worker instead of
 * fetching directly — see messages.ts for why. Works the same whether
 * called from the content script or the popup.
 */
async function apiFetch<T>(
  config: ExtensionConfig,
  path: string,
  options: { method?: string; body?: string } = {}
): Promise<T> {
  const request: ApiFetchRequest = {
    type: "DEAL_ASSISTANT_API_FETCH",
    apiBaseUrl: config.apiBaseUrl,
    apiKey: config.apiKey,
    path,
    method: options.method,
    body: options.body,
  };

  const response = (await chrome.runtime.sendMessage(request)) as ApiFetchResponse;

  if (!response.success) {
    throw new ApiError(response.error);
  }

  return response.data as T;
}

export function createSession(config: ExtensionConfig, meetLink: string): Promise<CallSession> {
  return apiFetch<CallSession>(config, "/api/sessions", {
    method: "POST",
    body: JSON.stringify({ meetLink, repEmail: config.repEmail }),
  });
}

export function getSession(config: ExtensionConfig, sessionId: string): Promise<CallSession> {
  return apiFetch<CallSession>(config, `/api/sessions/${sessionId}`);
}

export function postTranscript(
  config: ExtensionConfig,
  sessionId: string,
  chunks: TranscriptChunk[]
): Promise<CallSession> {
  return apiFetch<CallSession>(config, `/api/sessions/${sessionId}/transcript`, {
    method: "POST",
    body: JSON.stringify({ chunks }),
  });
}

export interface ExtractResponse {
  session: CallSession;
  objectionSuggestions: string[];
}

export function runExtract(config: ExtensionConfig, sessionId: string): Promise<ExtractResponse> {
  return apiFetch<ExtractResponse>(config, `/api/sessions/${sessionId}/extract`, {
    method: "POST",
  });
}

/**
 * Combines postTranscript + runExtract + runQuote into one request — used
 * by the live-call loop instead of three separate calls, since that loop
 * fires every couple of seconds for the whole call and each extra round
 * trip is latency the rep feels directly.
 */
export function ingestTranscript(
  config: ExtensionConfig,
  sessionId: string,
  chunks: TranscriptChunk[]
): Promise<ExtractResponse> {
  return apiFetch<ExtractResponse>(config, `/api/sessions/${sessionId}/ingest`, {
    method: "POST",
    body: JSON.stringify({ chunks }),
  });
}

export function saveRoles(
  config: ExtensionConfig,
  sessionId: string,
  roles: RoleScope[]
): Promise<CallSession> {
  return apiFetch<CallSession>(config, `/api/sessions/${sessionId}/roles`, {
    method: "POST",
    body: JSON.stringify({ roles }),
  });
}

export function saveScopeFlags(
  config: ExtensionConfig,
  sessionId: string,
  scopeFlags: ScopeFlag[]
): Promise<CallSession> {
  return apiFetch<CallSession>(config, `/api/sessions/${sessionId}/scope-flags`, {
    method: "POST",
    body: JSON.stringify({ scopeFlags }),
  });
}

export function runQuote(config: ExtensionConfig, sessionId: string): Promise<CallSession> {
  return apiFetch<CallSession>(config, `/api/sessions/${sessionId}/quote`, { method: "POST" });
}

export function lockPrice(
  config: ExtensionConfig,
  sessionId: string,
  finalPrice?: number
): Promise<CallSession> {
  return apiFetch<CallSession>(config, `/api/sessions/${sessionId}/lock-price`, {
    method: "POST",
    body: JSON.stringify(finalPrice !== undefined ? { finalPrice } : {}),
  });
}

export function generateJds(config: ExtensionConfig, sessionId: string): Promise<CallSession> {
  return apiFetch<CallSession>(config, `/api/sessions/${sessionId}/generate-jds`, {
    method: "POST",
  });
}
