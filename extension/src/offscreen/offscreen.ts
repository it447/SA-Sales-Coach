/**
 * Runs in a hidden offscreen document, not the background service worker --
 * service workers have no DOM, so they can't call getUserMedia() or use
 * MediaRecorder. This document's only job is: take the tabCapture stream ID
 * the background worker hands it, turn that into a real MediaStream, record
 * it, and upload the result straight to the rep's Drive (see saveRecording
 * below) -- falling back to a local download if no upload URL was
 * available (Google not connected) or the upload itself fails, so a
 * recording is never silently lost either way.
 *
 * tabCapture alone only captures what the tab OUTPUTS -- i.e. what the rep
 * hears (the other participants) -- not their own microphone input, since
 * Meet doesn't play a rep's own voice back to them. Confirmed on a real
 * solo test call: with nothing else in the call to output, the recording
 * had literally no audio at all. So this also captures the mic separately
 * and mixes the two together via the Web Audio API, keeping the tab's own
 * video track. The mic getUserMedia() call here relies on the extension's
 * origin already having mic permission granted -- offscreen documents are
 * invisible and can't show a permission prompt themselves, so popup.ts
 * does one real (visible, interactive) getUserMedia() call first, purely
 * to trigger/confirm that prompt, before ever telling this document to
 * start. If mic access still isn't available for any reason, this falls
 * back to tab-audio-only rather than failing the whole recording.
 */
import type { OffscreenStartRequest, OffscreenStopRequest, DownloadRecordingRequest, RecordingEndedRequest } from "../lib/messages";
import { getConfig } from "../lib/storage";
import { reportRecordingUploaded } from "../lib/api";
import { logDebug } from "../lib/debugLog";

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let captureStream: MediaStream | null = null;
let micStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let currentUploadUrl: string | null = null;
let currentSessionId: string | null = null;

chrome.runtime.onMessage.addListener((message: OffscreenStartRequest | OffscreenStopRequest, _sender, sendResponse) => {
  if (message?.type === "DEAL_ASSISTANT_OFFSCREEN_START") {
    startCapture(message.streamId, message.uploadUrl, message.sessionId)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
    return true; // keep the message channel open for the async response
  }
  if (message?.type === "DEAL_ASSISTANT_OFFSCREEN_STOP") {
    stopCapture();
    sendResponse({ success: true });
    return true;
  }
  return false;
});

async function startCapture(streamId: string, uploadUrl: string | null, sessionId: string): Promise<void> {
  currentUploadUrl = uploadUrl;
  currentSessionId = sessionId;
  // chromeMediaSource/chromeMediaSourceId are Chrome-specific, non-standard
  // getUserMedia constraints -- the "mandatory" wrapper is a legacy
  // Chrome-only constraint format still required to actually consume a
  // tabCapture stream ID. TypeScript's DOM lib doesn't know about any of
  // this, hence the cast.
  const constraints = {
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
    video: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
  } as unknown as MediaStreamConstraints;

  captureStream = await navigator.mediaDevices.getUserMedia(constraints);
  await logDebug(`got captureStream, tracks: ${captureStream.getTracks().map((t) => `${t.kind}:${t.readyState}:${t.label}`).join(", ")}`);

  // Before mic mixing, closing/leaving the Meet tab ended tabCapture's own
  // tracks, which auto-stops a MediaRecorder recording them directly --
  // that's how a real call finished cleanly without the rep needing to
  // remember to click "Stop Recording". But a MediaStreamAudioDestinationNode's
  // output track (below) has its OWN independent lifecycle -- it doesn't
  // end just because the tab audio track feeding into it did, so once mic
  // mixing was added, MediaRecorder had no track left to notice the tab
  // was gone, and closing it silently left the recording running forever
  // with nothing ever finalized. Explicitly stopping on the tab's own
  // track ending restores the old behavior regardless of mixing.
  captureStream.getVideoTracks().forEach((track) => {
    track.onended = () => {
      console.log("[DealAssistant] tab capture track ended (tab closed/left) -- auto-stopping recorder");
      stopCapture();
    };
  });

  // Mix in the rep's own mic (see file-level comment for why tab capture
  // alone isn't enough) -- best-effort: falls back to tab-audio-only if
  // this fails for any reason, rather than failing the whole recording.
  let recordingStream = captureStream;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await logDebug(`got micStream, tracks: ${micStream.getTracks().map((t) => `${t.kind}:${t.readyState}:${t.label}`).join(", ")}`);

    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    audioContext.createMediaStreamSource(captureStream).connect(destination);
    audioContext.createMediaStreamSource(micStream).connect(destination);

    recordingStream = new MediaStream([...captureStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
    await logDebug("mixed mic + tab audio into recordingStream");
  } catch (err) {
    await logDebug(`couldn't add mic audio, recording tab audio only: ${err instanceof Error ? err.message : String(err)}`);
  }

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(recordingStream, { mimeType: "video/webm;codecs=vp9,opus" });
  await logDebug(`MediaRecorder created, state: ${mediaRecorder.state}, mimeType: ${mediaRecorder.mimeType}`);

  mediaRecorder.ondataavailable = (e) => {
    console.log("[DealAssistant] ondataavailable, chunk size:", e.data.size, "total chunks so far:", recordedChunks.length + 1);
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onerror = (e) => {
    console.log("[DealAssistant] MediaRecorder error:", e);
  };
  mediaRecorder.onstop = () => {
    logDebug(`onstop fired, total chunks: ${recordedChunks.length}, total bytes: ${recordedChunks.reduce((sum, c) => sum + c.size, 0)}`);

    // Tell the background worker recording has ended, regardless of why
    // (explicit Stop click, or the tab capture track ending on its own) --
    // without this, an auto-stop left the background's own recordingTabId
    // state (and so the toolbar badge and the sidebar's status text)
    // stuck showing "still recording" forever, since nothing else would
    // ever tell it otherwise.
    const endedRequest: RecordingEndedRequest = { type: "DEAL_ASSISTANT_RECORDING_ENDED" };
    chrome.runtime.sendMessage(endedRequest).catch((err) => console.log("[DealAssistant] couldn't notify background of recording end:", err));

    // Release the capture BEFORE attempting the download below, not after.
    // A real crash here previously found chrome.downloads is undefined in
    // an offscreen document's context (it's a background-worker-only API,
    // confirmed via a genuine "Cannot read properties of undefined
    // (reading 'download')" error) -- that exception aborted this handler
    // partway through, before these lines ever ran, leaving the tab's
    // capture stream permanently "active" from Chrome's point of view
    // (blocking every subsequent Start Recording attempt on that tab with
    // "Cannot capture a tab with an active stream" until the whole
    // extension was reloaded). Ordering cleanup first means a failure in
    // the download step, whatever the cause, can no longer strand the tab
    // like that again.
    captureStream?.getTracks().forEach((t) => t.stop());
    captureStream = null;
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null;
    audioContext?.close();
    audioContext = null;
    mediaRecorder = null;

    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const uploadUrl = currentUploadUrl;
    const sessionId = currentSessionId;
    currentUploadUrl = null;
    currentSessionId = null;

    saveRecording(blob, uploadUrl, sessionId);
  };
  // 1s timeslice: periodic dataavailable events instead of one giant blob
  // only at the very end, both so a crash mid-call doesn't lose everything
  // and to set up for Phase 2's incremental/chunked upload.
  mediaRecorder.start(1000);
  console.log("[DealAssistant] mediaRecorder.start() called, state:", mediaRecorder.state);
}

function stopCapture(): void {
  console.log("[DealAssistant] stopCapture called, mediaRecorder state:", mediaRecorder?.state ?? "null");
  mediaRecorder?.stop();
}

/**
 * Uploads straight to Drive when an upload URL was obtained (see
 * popup.ts/api.ts), since that's what the dashboard actually surfaces --
 * falling back to a local download only if that wasn't possible (rep
 * hasn't connected Google yet) or something in the upload itself fails, so
 * a recording is never silently lost either way.
 */
async function saveRecording(blob: Blob, uploadUrl: string | null, sessionId: string | null): Promise<void> {
  await logDebug(`saveRecording called, blob size: ${blob.size}, uploadUrl: ${uploadUrl ? "present" : "null"}, sessionId: ${sessionId ?? "null"}`);
  if (uploadUrl && sessionId) {
    try {
      const driveFileId = await uploadToDrive(blob, uploadUrl);
      await logDebug(`uploaded to Drive, file id: ${driveFileId}`);
      const config = await getConfig();
      if (config) {
        await reportRecordingUploaded(config, sessionId, driveFileId);
        await logDebug(`reported upload to backend, session: ${sessionId}`);
      } else {
        await logDebug("no extension config found -- can't report the upload, but the file is safely in Drive.");
      }
      return;
    } catch (err) {
      await logDebug(`Drive upload failed, falling back to local download: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  downloadLocally(blob);
}

async function uploadToDrive(blob: Blob, uploadUrl: string): Promise<string> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/webm" },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`Drive upload failed with status ${res.status}: ${await res.text()}`);
  }
  const created: { id: string } = await res.json();
  return created.id;
}

function downloadLocally(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const filename = `deal-assistant-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
  logDebug(`requesting local download from background: ${filename}, blob size: ${blob.size}`);

  // chrome.downloads isn't available in an offscreen document -- the
  // background worker does the actual chrome.downloads.download() call
  // (see messages.ts). The blob: URL is still fetchable from there since
  // both share the same chrome-extension:// origin.
  const request: DownloadRecordingRequest = { type: "DEAL_ASSISTANT_DOWNLOAD_RECORDING", url, filename };
  chrome.runtime
    .sendMessage(request)
    .then((response) => logDebug(`download request response: ${JSON.stringify(response)}`))
    .catch((err) => logDebug(`download request failed: ${err}`))
    .finally(() => {
      // Revoking immediately risks racing the download actually starting.
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
}
