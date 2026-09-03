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

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(captureStream, { mimeType: "video/webm;codecs=vp9,opus" });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const filename = `deal-assistant-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
    chrome.downloads.download({ url, filename, saveAs: false }, () => {
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
}

function stopCapture(): void {
  mediaRecorder?.stop();
}
