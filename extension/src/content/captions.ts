/**
 * Live-caption scraping for Google Meet.
 *
 * CAVEAT: Meet has no public API or stable selectors for its caption DOM —
 * this uses the one reasonably stable signal available: caption regions are
 * marked with `aria-live` (an accessibility attribute, since captions need
 * to be announced to screen readers). This has worked across multiple past
 * Meet DOM overhauls because Google can't remove it without breaking
 * accessibility, but it CAN still break if Meet changes how it structures
 * caption updates. If captions stop being detected after a Meet UI update,
 * this is the first place to look — inspect the DOM while captions are on
 * and adjust the selector below.
 */

export type OnCaptionText = (text: string) => void;

const ARIA_LIVE_SELECTOR = '[aria-live="polite"], [aria-live="assertive"]';

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
    const nodes = document.querySelectorAll<HTMLElement>(ARIA_LIVE_SELECTOR);
    nodes.forEach((node) => {
      const text = node.textContent?.trim() ?? "";
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
