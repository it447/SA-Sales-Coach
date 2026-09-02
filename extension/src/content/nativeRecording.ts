/**
 * Fallback for starting Meet's native recording -- called unconditionally
 * once the rep joins a call they wanted recorded, regardless of whether
 * the pre-join API attempt (meetSpace.ts's setSpaceRecording) reported
 * success. Two separate reasons that API alone isn't enough:
 *
 * 1. It's organizer-only -- a hard Google API limitation with no
 *    workaround, and reps will usually be joining calls organized by
 *    someone else in production.
 * 2. Real-world testing found it can report success (echoing back the
 *    requested config) while Google never actually records anything, with
 *    no error surfaced at all -- so even a clean API response isn't
 *    trustworthy proof recording will really happen.
 *
 * This instead automates the exact same click sequence a human would use:
 * open the in-call "More options" menu, click "Record meeting", confirm
 * the dialog. Meet's own UI has historically let any internal participant
 * start a recording (subject to the org's meeting host management
 * settings), which the REST API cannot do regardless of settings. Safe to
 * call even when the API already succeeded: if recording is genuinely
 * already running, the menu shows "Stop recording" instead, which this
 * detects and treats as success rather than double-triggering anything.
 *
 * CAVEAT (same class as captions.ts): there is no public API for this UI,
 * so the selectors below are best-effort based on Meet's aria-label/role
 * conventions, not confirmed by direct inspection of a live call the way
 * captions.ts's selector was. This is the first place to look if this
 * stops working -- inspect the DOM during a real call and adjust.
 *
 * Only usable once actually IN a call (the "More options" menu with a
 * recording entry doesn't exist on the pre-join lobby screen), unlike the
 * API path which only works pre-join. See watchForCallJoin below.
 */

export interface RecordingUiResult {
  ok: boolean;
  reason: string;
}

function findByText(elements: Element[], needle: string): HTMLElement | null {
  const lower = needle.toLowerCase();
  for (const el of elements) {
    if ((el.textContent ?? "").trim().toLowerCase().includes(lower)) {
      return el as HTMLElement;
    }
  }
  return null;
}

async function waitFor<T>(fn: () => T | null, timeoutMs: number, intervalMs = 150): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = fn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

/** Attempts to start recording via Meet's own in-call "More options" > "Record meeting" menu. */
export async function startNativeRecordingViaUi(): Promise<RecordingUiResult> {
  const moreOptionsBtn = document.querySelector<HTMLElement>(
    'button[aria-label="More options"], button[aria-label*="More options" i]'
  );
  if (!moreOptionsBtn) {
    return { ok: false, reason: "Couldn't find Meet's \"More options\" button -- Meet's UI may have changed." };
  }
  moreOptionsBtn.click();

  const menuItems = await waitFor(
    () => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"], li, div[role="button"]'));
      return items.length > 0 ? items : null;
    },
    3000
  );

  // This function is called unconditionally once the rep joins, even when
  // the pre-join API call reported success -- that report isn't
  // trustworthy proof recording actually started (see content-script.ts).
  // If a recording genuinely is already running, the menu shows "Stop
  // recording" instead of "Record meeting", which is real, live proof
  // (unlike the API's echoed config) -- treat that as success, not a
  // failure to find anything.
  if (menuItems && findByText(menuItems, "stop recording")) {
    document.body.click();
    return { ok: true, reason: "Recording is already active." };
  }

  const recordMenuItem = menuItems ? findByText(menuItems, "record meeting") : null;
  if (!recordMenuItem) {
    // Close whatever menu we opened rather than leaving Meet's UI in a
    // half-open state the rep didn't ask for.
    document.body.click();
    return {
      ok: false,
      reason:
        '"Record meeting" isn\'t available in the menu -- your organization\'s meeting host settings likely restrict recording to the meeting organizer only.',
    };
  }
  recordMenuItem.click();

  const confirmBtn = await waitFor(
    () => findByText(Array.from(document.querySelectorAll('[role="dialog"] button')), "start recording"),
    3000
  );
  if (!confirmBtn) {
    return {
      ok: false,
      reason: 'Clicked "Record meeting" but no confirmation dialog appeared -- Meet\'s UI may have changed.',
    };
  }
  confirmBtn.click();

  return { ok: true, reason: "Recording started via Meet's in-call menu." };
}

/**
 * Polls for Meet's "Leave call" control, the most reliable signal that the
 * rep has actually joined (as opposed to still sitting on the pre-join
 * lobby screen, where the recording menu doesn't exist at all). Calls
 * onJoin once, then stops.
 */
export function watchForCallJoin(onJoin: () => void): void {
  const check = () => {
    const leaveButton = document.querySelector<HTMLElement>(
      'button[aria-label*="Leave call" i], button[aria-label*="Leave meeting" i]'
    );
    if (leaveButton) {
      onJoin();
      return;
    }
    setTimeout(check, 1000);
  };
  check();
}
