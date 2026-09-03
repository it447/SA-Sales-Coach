import { getConfig, setConfig, getSessionIdForMeet, setSessionIdForMeet, normalizeMeetLink } from "../lib/storage";
import { createSession, ApiError } from "../lib/api";
import { meetingNameFromTitle } from "../lib/meetingName";
import type { ExtensionConfig } from "../lib/storage";
import type {
  StartTabRecordingRequest,
  StopTabRecordingRequest,
  TabRecordingResponse,
  GetTabRecordingStateRequest,
  GetTabRecordingStateResponse,
} from "../lib/messages";

const root = document.getElementById("root")!;

function isMeetUrl(url: string | undefined): boolean {
  return !!url && url.startsWith("https://meet.google.com/");
}

function renderSettingsForm(existing: ExtensionConfig | null, message?: string): void {
  const apiBaseUrlValue = existing?.apiBaseUrl ?? "https://sa-sales-coach.vercel.app";
  const repEmailValue = existing?.repEmail ?? "";

  root.innerHTML = `
    <h1>Deal Assistant Settings</h1>
    ${message ? `<p class="muted">${message}</p>` : ""}
    <div class="field">
      <label>API base URL</label>
      <input id="apiBaseUrl" value="${apiBaseUrlValue}" />
    </div>
    <div class="field">
      <label>API key</label>
      <input id="apiKey" type="password" value="${existing?.apiKey ?? ""}" />
    </div>
    <div class="field">
      <label>Your email</label>
      <input id="repEmail" value="${repEmailValue}" />
    </div>
    <button id="save">Save Settings</button>
    <hr />
    <p class="muted">Optional -- only needed for the manual "Recording" toggle in the sidebar and finding a Meet-recorded file in Drive. Not required for the tab recording (this device) feature.</p>
    <button class="secondary" id="connectGoogle">Connect Google Account</button>
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

  document.getElementById("connectGoogle")!.addEventListener("click", () => {
    const apiBaseUrl = (document.getElementById("apiBaseUrl") as HTMLInputElement).value.trim().replace(/\/$/, "");
    const repEmail = (document.getElementById("repEmail") as HTMLInputElement).value.trim();
    if (!apiBaseUrl || !repEmail) {
      renderSettingsForm(existing, "Fill in the API base URL and your email first, then connect Google.");
      return;
    }
    chrome.tabs.create({ url: `${apiBaseUrl}/api/google/connect?repEmail=${encodeURIComponent(repEmail)}` });
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
    const tabId = tab!.id!;
    const stateResponse: GetTabRecordingStateResponse = await chrome.runtime.sendMessage({
      type: "DEAL_ASSISTANT_GET_TAB_RECORDING_STATE",
    } satisfies GetTabRecordingStateRequest);

    root.innerHTML = `
      <h1>Deal Assistant</h1>
      <p class="status">Session active for this call.</p>
      <p class="muted">Session ID: ${sessionId}</p>
      <p class="muted">The coaching sidebar should be visible on the right side of your Meet tab.</p>
      <hr />
      <p class="muted">Recording works regardless of who organized the call -- captures this tab's audio/video directly (must be started/stopped from here, not the sidebar, since Chrome only allows tab capture right after opening this popup).</p>
      ${
        stateResponse.isThisTabRecording
          ? `<button id="stopTabRecording">Stop Recording</button>`
          : `<button id="startTabRecording">Start Recording (this device)</button>`
      }
      <button class="secondary" id="editSettings">Edit Settings</button>
    `;

    document.getElementById("startTabRecording")?.addEventListener("click", async () => {
      const button = document.getElementById("startTabRecording") as HTMLButtonElement;
      button.disabled = true;
      button.textContent = "Starting…";
      const response: TabRecordingResponse = await chrome.runtime.sendMessage({
        type: "DEAL_ASSISTANT_START_TAB_RECORDING",
        tabId,
      } satisfies StartTabRecordingRequest);
      if (response.success) {
        renderMain();
      } else {
        root.innerHTML = `<h1>Deal Assistant</h1><p class="status" style="color:#e74c3c">${response.error}</p><button id="retry">Back</button>`;
        document.getElementById("retry")!.addEventListener("click", renderMain);
      }
    });

    document.getElementById("stopTabRecording")?.addEventListener("click", async () => {
      const button = document.getElementById("stopTabRecording") as HTMLButtonElement;
      button.disabled = true;
      button.textContent = "Stopping…";
      await chrome.runtime.sendMessage({ type: "DEAL_ASSISTANT_STOP_TAB_RECORDING" } satisfies StopTabRecordingRequest);
      renderMain();
    });

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
      const session = await createSession(config, meetLink, meetingNameFromTitle(tab?.title));
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
