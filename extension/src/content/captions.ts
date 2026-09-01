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
 */

export type OnCaptionText = (text: string) => void;

const CAPTIONS_SELECTOR = 'div[role="region"][aria-label="Captions"]';
const UI_CHROME_PATTERN = /arrow_downward\s*Jump to bottom|Live captions are on|Loading\.\.\./g;

export class CaptionWatcher {
  private observer: MutationObserver | null = null;
  private lastTextByNode = new WeakMap<Element, string>();
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
    nodes.forEach((node) => {
      const text = (node.textContent ?? "").replace(UI_CHROME_PATTERN, " ").trim();
      if (!text) return;

      const previous = this.lastTextByNode.get(node) ?? "";
      if (text === previous) return;

      this.hasSeenAnyCaption = true;

      // Meet typically rewrites the same line in place as a sentence is
      // being spoken, then starts a fresh line for the next utterance.
      // If the new text extends the old one, only emit the new suffix;
      // otherwise treat it as an unrelated new line.
      const delta = text.startsWith(previous) ? text.slice(previous.length) : text;
      if (delta.trim()) {
        this.onText(delta.trim());
      }

      this.lastTextByNode.set(node, text);
    });
  }
}
