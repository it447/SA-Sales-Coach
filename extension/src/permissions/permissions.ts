/**
 * A dedicated, full extension page (opened as a real tab via chrome.tabs.create
 * -- never as the toolbar popup) whose only job is to trigger Chrome's
 * microphone permission prompt for this extension's own origin.
 *
 * WHY THIS EXISTS: Chrome's toolbar popup is too transient/ephemeral for a
 * getUserMedia() permission prompt to anchor to -- calling it from there
 * (confirmed via real testing: no prompt ever appeared, not even a denial)
 * silently does nothing, leaving the mic permission stuck at "not decided"
 * forever. A real, persistent tab works fine, so popup.ts opens this page
 * instead of calling getUserMedia() itself whenever mic permission isn't
 * already granted. Once granted here, it's granted for the extension's
 * chrome-extension://<id> origin everywhere else too, including the
 * offscreen document's own getUserMedia({audio:true}) call during an
 * actual recording (see offscreen.ts) -- this page never needs to run
 * again after that.
 */

const message = document.getElementById("message")!;

navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then((stream) => {
    stream.getTracks().forEach((t) => t.stop());
    message.textContent = "Microphone access granted — you can close this tab and go back to Start Recording.";
    setTimeout(() => window.close(), 2500);
  })
  .catch((err) => {
    message.textContent = `Microphone access wasn't granted (${err instanceof Error ? err.message : String(err)}). Recordings will only include the other participants, not your own voice, until this is allowed.`;
  });
