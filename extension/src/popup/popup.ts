import { getConfig, setConfig, getSessionIdForMeet, setSessionIdForMeet, normalizeMeetLink } from "../lib/storage";
import { createSession, ApiError } from "../lib/api";
import type { ExtensionConfig } from "../lib/storage";

const root = document.getElementById("root")!;

function isMeetUrl(url: string | undefined): boolean {
  return !!url && url.startsWith("https://meet.google.com/");
}

/**
 * Google Meet tab titles are either the calendar event name (unsuffixed) or
 * just "Meet" for an ad-hoc call with no name — strip the latter down to
 * null so the dashboard falls back to its own role-derived label instead of
 * showing the meaningless word "Meet".
 */
function meetingNameFromTabTitle(title: string | undefined): string | null {
  const trimmed = title?.trim();
  if (!trimmed || trimmed === "Meet") return null;
  return trimmed;
}

function renderSettingsForm(existing: ExtensionConfig | null, message?: string): void {
  root.innerHTML = `
    <h1>Deal Assistant Settings</h1>
    ${message ? `<p class="muted">${message}</p>` : ""}
    <div class="field">
      <label>API base URL</label>
      <input id="apiBaseUrl" value="${existing?.apiBaseUrl ?? "https://sa-sales-coach.vercel.app"}" />
    </div>
    <div class="field">
      <label>API key</label>
      <input id="apiKey" type="password" value="${existing?.apiKey ?? ""}" />
    </div>
    <div class="field">
      <label>Your email</label>
      <input id="repEmail" value="${existing?.repEmail ?? ""}" />
    </div>
    <button id="save">Save Settings</button>
  `;

  document.getElementById("save")!.addEventListener("click", async () => {
    const apiBaseUrl = (document.getElementById("apiBaseUrl") as HTMLInputElement).value.trim().replace(/\/$/, "");
    const apiKey = (document.getElementById("apiKey") as HTMLInputElement).value.trim();
    const repEmail = (document.getElementById("repEmail") as HTMLInputElement).value.trim();

    if (!apiBaseUrl || !apiKey || !repEmail) {
      renderSettingsForm(existing, "All three fields are required.");
      return;
    }

    await setConfig({ apiBaseUrl, apiKey, repEmail });
    renderMain();
  });
}

async function renderMain(): Promise<void> {
  const config = await getConfig();
  if (!config) {
    renderSettingsForm(null);
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!isMeetUrl(tab?.url)) {
    root.innerHTML = `
      <h1>Deal Assistant</h1>
      <p class="status">Open a Google Meet call to start a session.</p>
      <button class="secondary" id="editSettings">Edit Settings</button>
    `;
    bindEditSettings(config);
    return;
  }

  const meetLink = normalizeMeetLink(tab!.url!);
  const sessionId = await getSessionIdForMeet(meetLink);

  if (sessionId) {
    root.innerHTML = `
      <h1>Deal Assistant</h1>
      <p class="status">Session active for this call.</p>
      <p class="muted">Session ID: ${sessionId}</p>
      <p class="muted">The coaching sidebar should be visible on the right side of your Meet tab.</p>
      <button class="secondary" id="editSettings">Edit Settings</button>
    `;
    bindEditSettings(config);
    return;
  }

  root.innerHTML = `
    <h1>Deal Assistant</h1>
    <p class="status">No active session for this call yet.</p>
    <button id="startCall">Start Call</button>
    <button class="secondary" id="editSettings">Edit Settings</button>
  `;

  document.getElementById("startCall")!.addEventListener("click", async () => {
    const button = document.getElementById("startCall") as HTMLButtonElement;
    button.disabled = true;
    button.textContent = "Starting…";
    try {
      const session = await createSession(config, meetLink, meetingNameFromTabTitle(tab?.title));
      await setSessionIdForMeet(meetLink, session.id);
      renderMain();
    } catch (err) {
      root.innerHTML = `
        <h1>Deal Assistant</h1>
        <p class="status" style="color:#e74c3c">${err instanceof ApiError ? err.message : "Failed to start session."}</p>
        <button id="retry">Retry</button>
      `;
      document.getElementById("retry")!.addEventListener("click", renderMain);
    }
  });

  bindEditSettings(config);
}

function bindEditSettings(config: ExtensionConfig): void {
  document.getElementById("editSettings")?.addEventListener("click", () => renderSettingsForm(config));
}

renderMain();
