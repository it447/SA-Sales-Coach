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
 * The delta is everything between the longest common PREFIX and the
 * longest common SUFFIX of the old and new text (word-level, not
 * character-level), not just "new text after the old text verbatim".
 * Google's live captions don't only grow at the end -- they revise
 * tentative words ANYWHERE in the sentence as more audio context arrives,
 * including mid-sentence (confirmed on a real call: the same clause
 * showed up twice in the transcript with different guessed words each
 * time, e.g. "...like with nickel transcript to be like me now" then
 * "...like bicycle transcript to coloss" for what was clearly one
 * utterance). A prefix-only diff can't tell a mid-sentence revision from
 * brand-new text: it stops at the changed word and re-emits everything
 * after it, including the unchanged tail that was already sent. Matching
 * the tail too (a common suffix) isolates just the actually-new-or-revised
 * middle span instead of duplicating what didn't change.
 */

export type OnCaptionText = (text: string) => void;

const CAPTIONS_SELECTOR = 'div[role="region"][aria-label="Captions"]';
const UI_CHROME_PATTERN = /arrow_downward\s*Jump to bottom|Live captions are on|Loading\.\.\./g;

/**
 * The new text's delta against the old text: strips the longest common
 * leading run of words, then the longest common trailing run of words
 * (bounded so the two runs can't overlap), leaving just what's actually
 * new or revised in between. Word-level, not character-level -- a
 * revised word is a whole-word swap, not a partial character match.
 */
function wordDelta(oldText: string, newText: string): string {
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);

  let prefixLen = 0;
  while (prefixLen < oldWords.length && prefixLen < newWords.length && oldWords[prefixLen] === newWords[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  const maxSuffix = Math.min(oldWords.length, newWords.length) - prefixLen;
  while (
    suffixLen < maxSuffix &&
    oldWords[oldWords.length - 1 - suffixLen] === newWords[newWords.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  return newWords.slice(prefixLen, newWords.length - suffixLen).join(" ");
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

    const delta = wordDelta(this.lastCombinedText, combined).trim();
    if (delta) {
      this.onText(delta);
    }

    this.lastCombinedText = combined;
  }
}
