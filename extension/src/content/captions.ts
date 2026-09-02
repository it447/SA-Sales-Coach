/**
 * Live-caption scraping for Google Meet.
 *
 * CAVEAT: Meet has no public API for its caption DOM. Confirmed by direct
 * inspection (2026-08): the captions container is
 * `div[role="region"][aria-label="Captions"]` — NOT `aria-live`, despite
 * that being the usual accessibility pattern for this kind of live-updating
 * text (our first guess, which didn't match anything real). We read the
 * whole region's text as one blob rather than depending on Google's
 * obfuscated inner class names (e.g. `ygicle`, `VbkSUe`), since those are
 * far more likely to change between Meet deployments than the semantic
 * role/aria-label. If captions stop being detected after a Meet UI update,
 * this is the first place to look — inspect the DOM while captions are on
 * and adjust the selector below.
 *
 * Deliberately NOT also matching the generic `[aria-live]` selector: Meet
 * puts that on plenty of unrelated UI (mic/camera toast notifications, the
 * "you joined" banner, the leave-call countdown, the device picker), and
 * querying it alongside the real region pulled all of that into the
 * transcript as if it were caption text. UI_CHROME_PATTERN strips text
 * baked into the captions region itself, notably the "Jump to bottom" pill
 * Meet renders as a nested child of the same region.
 *
 * Diffing is done against a single `lastCombinedText` string, NOT per-node
 * (e.g. a WeakMap keyed by the DOM node) -- Meet's captions region gets
 * recreated as a new element on updates rather than mutated in place, so
 * anything keyed by node identity loses track of "previous" on every
 * single update and re-emits the entire accumulated sentence from
 * scratch each time. Re-querying the selector and combining/deduping
 * whatever text is on screen right now sidesteps that entirely.
 *
 * The delta itself is everything after the LONGEST COMMON PREFIX of the
 * old and new text, not "new text starting with the old text verbatim".
 * Google's live captions constantly revise already-shown text as an
 * utterance continues -- most visibly, a tentative period gets replaced
 * as soon as more words arrive ("Hi there." -> "Hi there, so.") -- so a
 * strict startsWith check treats nearly every update as an unrelated new
 * line and re-emits the entire growing sentence on every revision.
 * Common-prefix diffing tolerates that: a one-word punctuation revision
 * only emits the changed tail, not the whole sentence again.
 */

export type OnCaptionText = (text: string) => void;

const CAPTIONS_SELECTOR = 'div[role="region"][aria-label="Captions"]';
const UI_CHROME_PATTERN = /arrow_downward\s*Jump to bottom|Live captions are on|Loading\.\.\./g;

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

export class CaptionWatcher {
  private observer: MutationObserver | null = null;
  private lastCombinedText = "";
  private hasSeenAnyCaption = false;
  private onText: OnCaptionText;

  constructor(onText: OnCaptionText) {
    this.onText = onText;
  }

  start(): void {
    this.observer = new MutationObserver(() => this.scan());
    this.observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    // Catch anything already on screen when we attach.
    this.scan();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  hasSeenCaptions(): boolean {
    return this.hasSeenAnyCaption;
  }

  private scan(): void {
    const nodes = document.querySelectorAll<HTMLElement>(CAPTIONS_SELECTOR);
    if (nodes.length === 0) return;

    // Dedupe identical text across nodes -- e.g. a visually-hidden
    // screen-reader mirror of the same captions alongside the visible
    // region would otherwise double every line.
    const texts = new Set<string>();
    nodes.forEach((node) => {
      const text = (node.textContent ?? "")
        .replace(UI_CHROME_PATTERN, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) texts.add(text);
    });
    const combined = Array.from(texts).join(" ");
    if (!combined || combined === this.lastCombinedText) return;

    this.hasSeenAnyCaption = true;

    const prefixLen = commonPrefixLength(this.lastCombinedText, combined);
    const delta = combined.slice(prefixLen).trim();
    if (delta) {
      this.onText(delta);
    }

    this.lastCombinedText = combined;
  }
}
