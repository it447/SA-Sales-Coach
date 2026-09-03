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
 * Real-call testing found a plain el.click() on Meet's "More options"
 * button doesn't reliably open the dropdown -- it sometimes silently does
 * nothing (confirmed via console logging: the same session that
 * successfully opened the menu and got all the way to the confirmation
 * dialogs on one attempt found ZERO real menu items on a later attempt,
 * same organizer, same call type). Meet's jsaction framework binds
 * separate handlers for pointerdown/pointerup/click, and a synthetic
 * .click() alone appears not to always satisfy whatever it uses to
 * recognize a real user gesture. Dispatching the fuller pointer/mouse
 * event sequence a real click actually produces is more reliable.
 */
function realClick(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const eventInit: MouseEventInit & PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    view: window,
  };
  el.dispatchEvent(new PointerEvent("pointerdown", { ...eventInit, pointerId: 1, isPrimary: true }));
  el.dispatchEvent(new MouseEvent("mousedown", eventInit));
  el.dispatchEvent(new PointerEvent("pointerup", { ...eventInit, pointerId: 1, isPrimary: true }));
  el.dispatchEvent(new MouseEvent("mouseup", eventInit));
  el.dispatchEvent(new MouseEvent("click", eventInit));
  el.click(); // belt-and-suspenders in case the framework specifically wants a "real" click() call
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
function findByText(elements: Element[], needle: string, maxLength = Infinity): HTMLElement | null {
  const lower = needle.toLowerCase();
  let best: HTMLElement | null = null;
  let bestLength = Infinity;
  for (const el of elements) {
    const text = (el.textContent ?? "").trim().toLowerCase();
    if (text.includes(lower) && text.length <= maxLength && text.length < bestLength) {
      best = el as HTMLElement;
      bestLength = text.length;
    }
  }
  return best;
}

/**
 * Real-call testing found Google's own "New feature: X is available"
 * onboarding nudges (e.g. "Gemini is available...") can appear right
 * around when the in-call menu is opened, and their description text can
 * itself contain words like "recording" ("It won't create a recording
 * or store caption data...") -- which without this guard gets mistaken by
 * findByText's substring search for the actual "Recording" menu item once
 * the real menu has closed. Dismissing any such nudge before attempting
 * the recording click sequence removes both the false-match risk and
 * whatever is causing the real menu to close early in the first place.
 */
function dismissFeatureNudges(): void {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, div[role='button']"));
  for (const el of candidates) {
    const text = (el.textContent ?? "").trim().toLowerCase();
    if (text === "don't show again" || text === "got it" || text === "dismiss") {
      realClick(el);
    }
  }

  // Real-call testing found the nudge can still be showing only its
  // icon-only "x" close button at the point we check (the "Don't show
  // again"/"Learn more" row above wasn't enough alone) -- aria-label*=close
  // is too generic to click unscoped (Meet has other close buttons, e.g.
  // for chat/side panels), so only click one whose nearby ancestor's text
  // confirms it's actually this kind of nudge card, not unrelated UI.
  for (const closeBtn of Array.from(
    document.querySelectorAll<HTMLElement>('button[aria-label*="close" i], button[aria-label*="dismiss" i]')
  )) {
    let ancestor: HTMLElement | null = closeBtn.parentElement;
    for (let i = 0; i < 6 && ancestor; i++) {
      if ((ancestor.textContent ?? "").toLowerCase().includes("is available")) {
        realClick(closeBtn);
        break;
      }
      ancestor = ancestor.parentElement;
    }
  }
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

  // maxLength=40 keeps the text searches below from ever matching a long,
  // unrelated block of copy (e.g. a Google onboarding nudge's description)
  // just because it happens to contain the phrase somewhere in a sentence
  // -- real-call testing found exactly that: a "Gemini is available..."
  // popup's description text ("It won't create a recording...") got
  // matched as the "Recording" menu item once the real menu had already
  // closed. This guard alone surfaces a clear "not found" instead of
  // clicking the wrong thing; combined with the retry loop below (which
  // also dismisses the nudge and reopens the menu), the real item should
  // now get found in almost all cases where recording is actually available.
  const MENU_ITEM_MAX_LENGTH = 40;

  // A Google onboarding nudge (e.g. "Gemini is available...") appearing
  // around the same time our menu opens can steal focus and close it
  // before we get to search -- retrying the open (after clearing the
  // nudge out of the way) covers that race instead of failing outright
  // on the first closed-menu attempt.
  let recordMenuItem: HTMLElement | null = null;
  let alreadyRecording = false;
  for (let attempt = 0; attempt < 2 && !recordMenuItem && !alreadyRecording; attempt++) {
    dismissFeatureNudges();
    realClick(moreOptionsBtn);
    // aria-expanded is the one direct signal Meet's own button gives us
    // that the dropdown actually opened, as opposed to inferring it
    // indirectly from whether we later find a "Recording" row -- logging
    // it tells us definitively whether the click itself is the problem.
    console.log(`[DealAssistant] attempt ${attempt}: moreOptionsBtn aria-expanded after click:`, moreOptionsBtn.getAttribute("aria-expanded"));

    // Meet's own menu items are plain divs driven by its internal
    // jscontroller/jsaction framework, not standard ARIA role="menuitem"
    // elements -- matching broadly on clickable-looking containers and
    // filtering by visible text (below) is more robust here than assuming
    // semantic roles that may not be present.
    const menuItems = await waitFor(
      () => {
        dismissFeatureNudges(); // in case a nudge mounted after the menu opened and is about to close it
        const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="button"], li, span, div'));
        return items.length > 0 ? items : null;
      },
      3000
    );
    console.log(`[DealAssistant] attempt ${attempt}: menuItems found:`, menuItems?.length ?? 0);

    // This function is called unconditionally once the rep joins, even when
    // the pre-join API call reported success -- that report isn't
    // trustworthy proof recording actually started (see content-script.ts).
    // Not confirmed yet whether an active recording changes this menu
    // entry's label (e.g. to "Stop recording") or leaves it as "Recording"
    // and only changes what's inside the panel it opens -- checked
    // defensively; harmless if it never matches.
    if (menuItems && findByText(menuItems, "stop recording", MENU_ITEM_MAX_LENGTH)) {
      alreadyRecording = true;
      break;
    }

    // Not directly confirmed whether this specific row also carries an
    // aria-label the way the "Start recording" button does (see below), but
    // it's a consistent enough Google pattern to try first regardless,
    // falling back to the text search either way.
    recordMenuItem =
      document.querySelector<HTMLElement>('[aria-label="Recording"], [aria-label*="Recording" i]') ??
      (menuItems ? findByText(menuItems, "recording", MENU_ITEM_MAX_LENGTH) : null);

    if (!recordMenuItem && menuItems) {
      // No length cap here -- this is diagnostic only (never clicked), so
      // it's fine to see the near-misses this attempt's cap rejected too.
      const nearMisses = menuItems
        .map((el) => (el.textContent ?? "").trim())
        .filter((text) => text.toLowerCase().includes("record") && text.length > 0);
      console.log(`[DealAssistant] attempt ${attempt}: no exact recordMenuItem match; near-misses containing "record":`, nearMisses);
    }

    if (!recordMenuItem) {
      document.body.click(); // close whatever menu (if any) is left open before retrying
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  if (alreadyRecording) {
    document.body.click();
    return { ok: true, reason: "Recording is already active." };
  }

  if (!recordMenuItem) {
    return {
      ok: false,
      reason:
        '"Recording" isn\'t available in the More-options menu -- your organization\'s meeting host settings likely restrict recording to the meeting organizer only.',
    };
  }
  console.log("[DealAssistant] recordMenuItem:", recordMenuItem.outerHTML.slice(0, 300));
  realClick(recordMenuItem);
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
  realClick(confirmBtn);

  // Real-call testing found clicking "Start recording" doesn't actually
  // start anything by itself -- it opens a SECOND consent dialog ("Make
  // sure everyone is ready", warning that recording without consent may
  // be illegal) with its own "Start"/"Cancel" buttons, and recording only
  // truly begins once "Start" there is clicked too. Matching on exact
  // trimmed text "start" (not a substring match) is safe here: no other
  // button on the page has that as its *entire* label, unlike "Start
  // recording" which does substring-overlap with this if not exact.
  const secondConfirmBtn = await waitFor(
    () =>
      Array.from(document.querySelectorAll<HTMLElement>("button")).find(
        (b) => (b.textContent ?? "").trim().toLowerCase() === "start"
      ) ?? null,
    5000
  );
  if (secondConfirmBtn) {
    console.log("[DealAssistant] secondConfirmBtn (consent dialog) found, clicking:", secondConfirmBtn.outerHTML.slice(0, 300));
    realClick(secondConfirmBtn);
  } else {
    // Not necessarily a failure -- this consent dialog may not always
    // appear (e.g. depending on org policy or meeting type), so recording
    // may already be running from the first click.
    console.log("[DealAssistant] no second consent dialog appeared -- assuming recording already started.");
  }

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
