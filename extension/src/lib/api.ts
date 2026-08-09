import type { ExtensionConfig } from "./storage";
import type { CallSession, RoleScope, ScopeFlag, TranscriptChunk } from "../types";

export class ApiError extends Error {}

async function apiFetch<T>(
  config: ExtensionConfig,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(body?.error || `Request to ${path} failed with status ${res.status}`);
  }

  return body as T;
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
