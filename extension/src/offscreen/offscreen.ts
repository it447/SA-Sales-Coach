/**
 * Runs in a hidden offscreen document, not the background service worker --
 * service workers have no DOM, so they can't call getUserMedia() or use
 * MediaRecorder. This document's only job is: take the tabCapture stream ID
 * the background worker hands it, turn that into a real MediaStream, record
 * it, and (Phase 1) hand the result to the rep as a local download so we can
 * validate the capture itself works before building a cloud-upload pipeline
 * on top of it.
 *
 * KNOWN LIMITATION (Phase 1): tabCapture captures what the tab OUTPUTS --
 * i.e. what the rep hears (the other participants) -- not their own
 * microphone input, since Meet doesn't play a rep's own voice back to them.
 * The rep's own side of the conversation is missing from this recording
 * until a later pass mixes in a separate mic capture via the Web Audio API.
 */
import type { OffscreenStartRequest, OffscreenStopRequest } from "../lib/messages";

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let captureStream: MediaStream | null = null;

chrome.runtime.onMessage.addListener((message: OffscreenStartRequest | OffscreenStopRequest, _sender, sendResponse) => {
  if (message?.type === "DEAL_ASSISTANT_OFFSCREEN_START") {
    startCapture(message.streamId)
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

async function startCapture(streamId: string): Promise<void> {
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
  console.log(
    "[DealAssistant] got captureStream, tracks:",
    captureStream.getTracks().map((t) => `${t.kind}:${t.readyState}:${t.label}`)
  );

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(captureStream, { mimeType: "video/webm;codecs=vp9,opus" });
  console.log("[DealAssistant] MediaRecorder created, state:", mediaRecorder.state, "mimeType:", mediaRecorder.mimeType);

  mediaRecorder.ondataavailable = (e) => {
    console.log("[DealAssistant] ondataavailable, chunk size:", e.data.size, "total chunks so far:", recordedChunks.length + 1);
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onerror = (e) => {
    console.log("[DealAssistant] MediaRecorder error:", e);
  };
  mediaRecorder.onstop = () => {
    console.log("[DealAssistant] onstop fired, total chunks:", recordedChunks.length, "total bytes:", recordedChunks.reduce((sum, c) => sum + c.size, 0));
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const filename = `deal-assistant-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
    console.log("[DealAssistant] starting download:", filename, "blob size:", blob.size);
    chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.log("[DealAssistant] downloads.download failed:", chrome.runtime.lastError.message);
      } else {
        console.log("[DealAssistant] downloads.download succeeded, downloadId:", downloadId);
      }
      // Revoking immediately risks racing the download actually starting --
      // Phase 1 only; Phase 2 uploads the blob directly instead of ever
      // creating a local download, so this workaround goes away then.
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
    captureStream?.getTracks().forEach((t) => t.stop());
    captureStream = null;
    mediaRecorder = null;
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
