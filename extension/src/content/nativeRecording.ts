/**
 * Automates small pieces of Meet's own in-call UI that don't have a public
 * API -- currently just turning on live captions. There used to be a much
 * larger chunk of this file automating Meet's native-recording menu
 * ("More options" -> "Recording" -> "Start recording"), but that's gone
 * now that recording is handled by tabCapture instead (see
 * background/service-worker.ts and offscreen.ts) -- tabCapture works
 * regardless of who organized the call, where Meet's native recording
 * (both its REST API and this in-call menu) is organizer-only, a hard
 * Google-side restriction with no workaround.
 */

export interface RecordingUiResult {
  ok: boolean;
  reason: string;
}

/**
 * Real-call testing found a plain el.click() on Meet's own UI doesn't
 * reliably register (confirmed via console logging on the old recording-
 * menu automation this file used to also contain: the same session that
 * successfully opened a menu on one attempt found nothing on a later one,
 * same call, same button). Meet's jsaction framework binds separate
 * handlers for pointerdown/pointerup/click, and a synthetic .click() alone
 * appears not to always satisfy whatever it uses to recognize a real user
 * gesture. Dispatching the fuller pointer/mouse event sequence a real
 * click actually produces is more reliable.
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
 * Turns on Meet's own live captions (the toolbar "CC" button) so
 * captions.ts's scraper has something to read without the rep needing to
 * remember to click it every call -- captions.ts already warns when none
 * are detected, but this removes the manual step causing that in the
 * first place. A single, well-known toolbar button (not several layers
 * into a submenu the way the old recording automation was), and Google's
 * own aria-label convention for it ("Turn on captions" / "Turn off
 * captions", toggling with state) has been stable for years -- still
 * unconfirmed by direct inspection the way other selectors in this
 * codebase eventually were, so this is the first place to check if it
 * doesn't work on a real call.
 */
export async function enableCaptionsViaUi(): Promise<RecordingUiResult> {
  const alreadyOnBtn = document.querySelector<HTMLElement>(
    'button[aria-label="Turn off captions"], button[aria-label*="Turn off captions" i]'
  );
  if (alreadyOnBtn) {
    return { ok: true, reason: "Captions are already on." };
  }

  const ccBtn = document.querySelector<HTMLElement>(
    'button[aria-label="Turn on captions"], button[aria-label*="Turn on captions" i]'
  );
  if (!ccBtn) {
    return { ok: false, reason: "Couldn't find Meet's captions (CC) button -- Meet's UI may have changed." };
  }
  console.log("[DealAssistant] captions toggle button:", ccBtn.outerHTML.slice(0, 300));
  realClick(ccBtn);
  return { ok: true, reason: "Turned on Meet's live captions." };
}

/**
 * Polls for Meet's "Leave call" control, the most reliable signal that the
 * rep has actually joined (as opposed to still sitting on the pre-join
 * lobby screen, where the in-call toolbar doesn't exist yet). Calls onJoin
 * once, then stops.
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
