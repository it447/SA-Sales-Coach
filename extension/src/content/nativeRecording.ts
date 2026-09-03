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

/**
 * Finds the element whose text most tightly matches needle -- the
 * SHORTEST matching textContent, not just the first one found. Meet's
 * menu rows are plain, deeply-nested divs (no semantic role="menuitem"),
 * and a div's textContent includes all its descendants' text too, so a
 * naive first-match risks returning a large wrapping container instead
 * of the actual clickable row. Clicking the wrong (too-large) node can
 * silently no-op given Meet's own jsaction event-delegation framework,
 * which dispatches based on the real click target.
 */
function findByText(elements: Element[], needle: string): HTMLElement | null {
  const lower = needle.toLowerCase();
  let best: HTMLElement | null = null;
  let bestLength = Infinity;
  for (const el of elements) {
    const text = (el.textContent ?? "").trim().toLowerCase();
    if (text.includes(lower) && text.length < bestLength) {
      best = el as HTMLElement;
      bestLength = text.length;
    }
  }
  return best;
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

/**
 * Attempts to start recording via Meet's own in-call "More options" menu.
 * Confirmed by direct inspection (2026-09) of a real call's More-options
 * menu: the entry is labeled plain "Recording" (an icon + that word),
 * not "Record meeting" as first guessed -- clicking it opens a full side
 * panel ("Record your video call...") with a "Start recording" button,
 * not a small popup dialog.
 */
export async function startNativeRecordingViaUi(): Promise<RecordingUiResult> {
  // Real-call testing found Meet has MORE THAN ONE button labeled "More
  // options" -- each video tile has its own (tile-management options like
  // "Pin to the screen", nothing about recording), separate from the main
  // call-controls toolbar's. An unscoped match grabbed a tile's by
  // accident (whichever happened to be first in the DOM), opening the
  // wrong menu entirely. The real toolbar sits inside a container marked
  // aria-label="Call controls" (confirmed by direct inspection) -- scope
  // to that first, falling back to the first unscoped match only if that
  // container isn't found at all.
  const moreOptionsBtn =
    document.querySelector<HTMLElement>(
      '[aria-label="Call controls"] button[aria-label="More options"], [aria-label="Call controls"] button[aria-label*="More options" i]'
    ) ?? document.querySelector<HTMLElement>('button[aria-label="More options"], button[aria-label*="More options" i]');
  if (!moreOptionsBtn) {
    return { ok: false, reason: "Couldn't find Meet's \"More options\" button -- Meet's UI may have changed." };
  }
  console.log("[DealAssistant] moreOptionsBtn:", moreOptionsBtn.outerHTML.slice(0, 300));
  moreOptionsBtn.click();

  // Meet's own menu items are plain divs driven by its internal
  // jscontroller/jsaction framework, not standard ARIA role="menuitem"
  // elements -- matching broadly on clickable-looking containers and
  // filtering by visible text (below) is more robust here than assuming
  // semantic roles that may not be present.
  const menuItems = await waitFor(
    () => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="button"], li, span, div'));
      return items.length > 0 ? items : null;
    },
    3000
  );
  console.log("[DealAssistant] menuItems found:", menuItems?.length ?? 0);

  // This function is called unconditionally once the rep joins, even when
  // the pre-join API call reported success -- that report isn't
  // trustworthy proof recording actually started (see content-script.ts).
  // Not confirmed yet whether an active recording changes this menu
  // entry's label (e.g. to "Stop recording") or leaves it as "Recording"
  // and only changes what's inside the panel it opens -- checked
  // defensively; harmless if it never matches.
  if (menuItems && findByText(menuItems, "stop recording")) {
    document.body.click();
    return { ok: true, reason: "Recording is already active." };
  }

  // Not directly confirmed whether this specific row also carries an
  // aria-label the way the "Start recording" button does (see below), but
  // it's a consistent enough Google pattern to try first regardless,
  // falling back to the text search either way.
  const recordMenuItem =
    document.querySelector<HTMLElement>('[aria-label="Recording"], [aria-label*="Recording" i]') ??
    (menuItems ? findByText(menuItems, "recording") : null);
  if (!recordMenuItem) {
    // Close whatever menu we opened rather than leaving Meet's UI in a
    // half-open state the rep didn't ask for.
    document.body.click();
    return {
      ok: false,
      reason:
        '"Recording" isn\'t available in the More-options menu -- your organization\'s meeting host settings likely restrict recording to the meeting organizer only.',
    };
  }
  console.log("[DealAssistant] recordMenuItem:", recordMenuItem.outerHTML.slice(0, 300));
  recordMenuItem.click();
  console.log("[DealAssistant] clicked recordMenuItem, waiting for confirm button...");

  // Clicking "Recording" opens a full side panel ("Record your video
  // call...", confirmed by direct inspection) with a "Start recording"
  // button, not a small popup. Confirmed by direct inspection: the button
  // itself carries aria-label="Start recording" (its visible label text
  // lives in a separate aria-hidden span, standard Google pattern) -- an
  // exact aria-label match is far more reliable than hunting through
  // nested spans by text, so that's tried first with the text search only
  // as a fallback in case a future UI change drops the aria-label.
  // Real-call testing found the panel (illustration + checkboxes) can
  // take longer to fully render than the earlier, simpler menu did --
  // given more time than the other waits in this file.
  const confirmBtn = await waitFor(
    () =>
      document.querySelector<HTMLElement>('button[aria-label="Start recording"], button[aria-label*="Start recording" i]') ??
      findByText(
        Array.from(document.querySelectorAll('[role="dialog"] button, [role="dialog"] div, [role="dialog"] span, button')),
        "start recording"
      ),
    8000
  );
  if (!confirmBtn) {
    console.log(
      "[DealAssistant] no confirm button found; buttons on page now:",
      Array.from(document.querySelectorAll("button"))
        .map((b) => b.getAttribute("aria-label"))
        .filter(Boolean)
    );
    return {
      ok: false,
      reason: 'Clicked "Recording" but no "Start recording" confirmation appeared -- Meet\'s UI may have changed.',
    };
  }
  console.log("[DealAssistant] confirmBtn found:", confirmBtn.outerHTML.slice(0, 300));
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
