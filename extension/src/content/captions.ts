/**
 * Live-caption scraping for Google Meet, with per-speaker attribution.
 *
 * CAVEAT: Meet has no public API for its caption DOM. Confirmed by direct
 * inspection (2026-08): the captions container is
 * `div[role="region"][aria-label="Captions"]` — NOT `aria-live`, despite
 * that being the usual accessibility pattern for this kind of live-updating
 * text (our first guess, which didn't match anything real). If captions
 * stop being detected after a Meet UI update, this is the first place to
 * look — inspect the DOM while captions are on and adjust the selector
 * below.
 *
 * Deliberately NOT also matching the generic `[aria-live]` selector: Meet
 * puts that on plenty of unrelated UI (mic/camera toast notifications, the
 * "you joined" banner, the leave-call countdown, the device picker), and
 * querying it alongside the real region pulled all of that into the
 * transcript as if it were caption text.
 *
 * SPEAKER STRUCTURE (confirmed via a real multi-speaker call, 2026-09):
 * inside the region, each speaker who's spoken recently gets their own
 * sibling `<div>` block -- a new block is appended when a different
 * speaker starts talking, and an existing speaker's block gets revised in
 * place while they keep talking. Each block has exactly two direct-child
 * divs: one containing an `<img>` avatar plus the speaker's name (in a
 * nested `<span>`), the other holding that speaker's caption text with no
 * further nesting. We identify a block by "has an <img> descendant" and
 * split its two children by "the one with the img" vs. "the one without"
 * -- deliberately NOT by Meet's own class names (e.g. `nMcdL`, `ygicle`,
 * `NWpY1d`), since those are auto-generated/obfuscated and far more likely
 * to change between Meet deployments than this general avatar+name+text
 * layout. Other region children (the "Jump to bottom" button, a hidden
 * placeholder div) have no `<img>` and are naturally excluded by this
 * filter, with no need for a separate text blocklist.
 *
 * Diffing is done per-speaker against a `lastTextBySpeaker` map, NOT
 * per-DOM-node (e.g. a WeakMap keyed by the node) -- Meet's captions
 * region gets recreated on updates rather than mutated in place, so
 * anything keyed by node identity loses track of "previous" on every
 * single update. Keying by the speaker's displayed name instead survives
 * that, and also naturally handles a speaker's block scrolling off and a
 * later block for the same name appearing again later in the call: if the
 * new text doesn't share a prefix/suffix with the old (a fresh, unrelated
 * utterance), the whole thing is correctly treated as new rather than
 * needing to reconcile against stale state.
 *
 * The delta for a given speaker is everything between the longest common
 * PREFIX and the longest common SUFFIX of their old and new text
 * (word-level, not character-level), not just "new text after the old
 * text verbatim". Google's live captions don't only grow at the end --
 * they revise tentative words ANYWHERE in the sentence as more audio
 * context arrives, including mid-sentence (confirmed on a real call: the
 * same clause showed up twice with different guessed words each time). A
 * prefix-only diff can't tell a mid-sentence revision from brand-new text.
 * Matching the tail too isolates just the actually-new-or-revised middle
 * span instead of duplicating what didn't change.
 */

export type OnCaptionText = (speaker: string | null, text: string) => void;

const CAPTIONS_SELECTOR = 'div[role="region"][aria-label="Captions"]';

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

interface SpeakerBlock {
  speaker: string | null;
  text: string;
}

/**
 * Splits the captions region into one entry per speaker block. See the
 * SPEAKER STRUCTURE note above for why blocks are identified by "has an
 * <img> descendant" rather than by class name.
 */
function extractSpeakerBlocks(region: HTMLElement): SpeakerBlock[] {
  const blocks: SpeakerBlock[] = [];

  for (const child of Array.from(region.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (!child.querySelector("img")) continue; // not a speaker block (button controls, hidden chrome, etc.)

    const directChildren = Array.from(child.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
    const avatarWrapper = directChildren.find((c) => c.querySelector("img"));
    const textDiv = directChildren.find((c) => c !== avatarWrapper);

    const speaker = avatarWrapper?.querySelector("span")?.textContent?.trim() || null;
    const text = (textDiv?.textContent ?? "").replace(/\s+/g, " ").trim();

    if (text) blocks.push({ speaker, text });
  }

  return blocks;
}

export class CaptionWatcher {
  private observer: MutationObserver | null = null;
  private lastTextBySpeaker = new Map<string | null, string>();
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
    // Meet sometimes renders a second, visually-hidden mirror of the same
    // region for screen readers -- only the first one is needed, and
    // processing both would double-emit every line.
    const region = document.querySelector<HTMLElement>(CAPTIONS_SELECTOR);
    if (!region) return;

    const blocks = extractSpeakerBlocks(region);
    if (blocks.length === 0) return;

    this.hasSeenAnyCaption = true;

    for (const block of blocks) {
      const previous = this.lastTextBySpeaker.get(block.speaker) ?? "";
      if (block.text === previous) continue;

      const delta = wordDelta(previous, block.text).trim();
      if (delta) {
        this.onText(block.speaker, delta);
      }
      this.lastTextBySpeaker.set(block.speaker, block.text);
    }
  }
}
