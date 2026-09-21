// Derives the SHAPE of the scorecard -- which categories exist, what each is
// worth, who scores each one, and the pass mark -- from the rubric doc
// itself (config/scorecard-rubric.md). Nothing about the scoring model is
// hardcoded here: edit the doc and the next call scored uses the new shape,
// with no code change. Ported from the standalone ScoreCardApp, which
// pioneered this doc-driven approach; kept byte-for-byte in behavior since
// the whole point is that the doc (not this file) is what changes.
//
// The doc has to keep two things machine-readable:
//
//   Category 1: Script & Call Flow — /12          → an AI-scored category worth 12
//   Category 9: Body Language — MANUAL SCORE ONLY → a reviewer-only category
//   ... Pass = 53/75 ...                          → the pass mark
//
// Markdown "###" in front of a heading is optional, and so is the case of
// "Category" -- the doc gets round-tripped through Google Docs/Claude chats
// periodically, which reliably strips "#" markers.
//
// Because headings are matched without relying on "#", the match is
// deliberately strict about the ending: a line only counts as a category if
// it ends in "— /N" or a manual marker. The totals cross-check at the
// bottom is the backstop -- if a category ever gets dropped, the points
// won't add up to the declared total and loading the doc fails loudly.

export interface ScorecardCategory {
  key: string;
  name: string;
  max: number;
  scoredBy: "ai" | "reviewer";
}

export interface ScorecardStructure {
  /** Every category the doc defines, in document order. */
  categories: ScorecardCategory[];
  /** The ones the AI scores. */
  aiCategories: ScorecardCategory[];
  /** The ones the doc reserves for a human reviewer. */
  reviewerCategories: ScorecardCategory[];
  /** Points available to the AI (sum of aiCategories). */
  aiMaxScore: number;
  /** Points available overall (sum of every category). */
  totalMaxScore: number;
  passThreshold: number;
}

/** A doc the parser can't read. The message is meant to be admin-actionable. */
export class ScorecardFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScorecardFormatError";
  }
}

// "Category 9: Body Language — MANUAL SCORE ONLY", with or without leading "###".
const CATEGORY_HEADING = /^[ \t]*#{0,6}[ \t]*CATEGORY[ \t]+\d+[ \t]*:[ \t]*(.+?)[ \t]*$/gim;

// Splits "Script & Call Flow — /12" into the name and the qualifier after the last dash.
const NAME_AND_QUALIFIER = /^(.*)[ \t]*[—–-][ \t]*([^—–-]+?)[ \t]*$/;

const POINTS_QUALIFIER = /^\/[ \t]*(\d+)$/;
const MANUAL_QUALIFIER = /^manual\b|\bmanual[ \t]+score/i;

function unescapeMarkdown(s: string): string {
  return s.replace(/\\([^\w\s])/g, "$1");
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "category"
  );
}

/**
 * Parse the rubric doc into the scorecard's structure.
 * @throws {ScorecardFormatError} when a required piece is missing or inconsistent.
 */
export function parseScorecardStructure(doc: string): ScorecardStructure {
  const text = unescapeMarkdown(doc);

  const eachValues = new Set(
    [...text.matchAll(/(\d+)[ \t]*points?[ \t]+each/gi)].map((m) => m[1])
  );
  const defaultMax = eachValues.size === 1 ? Number([...eachValues][0]) : null;

  const categories: ScorecardCategory[] = [];
  const usedKeys = new Set<string>();

  for (const match of text.matchAll(CATEGORY_HEADING)) {
    const heading = match[1];
    const split = NAME_AND_QUALIFIER.exec(heading);
    if (!split) continue;

    const name = split[1].trim();
    const qualifier = split[2].trim();
    const points = POINTS_QUALIFIER.exec(qualifier);
    const isReviewer = !points && MANUAL_QUALIFIER.test(qualifier);
    if (!points && !isReviewer) continue;

    const max = points ? Number(points[1]) : defaultMax;

    if (!name) continue;
    if (!max) {
      throw new ScorecardFormatError(
        `Category "${name}" doesn't say what it's worth. End its heading with a point ` +
          `value, e.g. "Category 9: ${name} — /10".`
      );
    }

    let key = slugify(name);
    for (let n = 2; usedKeys.has(key); n++) key = `${slugify(name)}_${n}`;
    usedKeys.add(key);

    categories.push({ key, name, max, scoredBy: isReviewer ? "reviewer" : "ai" });
  }

  if (categories.length === 0) {
    throw new ScorecardFormatError(
      `No categories found. Each category needs its own line ending in a point value, ` +
        `e.g. "Category 1: Script & Call Flow — /12".`
    );
  }

  const aiCategories = categories.filter((c) => c.scoredBy === "ai");
  if (aiCategories.length === 0) {
    throw new ScorecardFormatError(
      `Every category is marked MANUAL SCORE ONLY, so there is nothing for the AI to score.`
    );
  }

  const pass = /pass[ \t]*=[ \t]*(\d+)[ \t]*\/[ \t]*(\d+)/i.exec(text);
  if (!pass) {
    throw new ScorecardFormatError(
      `No pass mark found. The doc needs a line stating it, e.g. "Pass = 63/90".`
    );
  }
  const passThreshold = Number(pass[1]);
  const declaredTotal = Number(pass[2]);

  const totalMaxScore = categories.reduce((sum, c) => sum + c.max, 0);
  if (declaredTotal !== totalMaxScore) {
    throw new ScorecardFormatError(
      `The pass line says the scorecard is out of ${declaredTotal}, but the ${categories.length} ` +
        `categories add up to ${totalMaxScore}. Update "Pass = ${passThreshold}/${declaredTotal}" to ` +
        `match, or fix the category point values.`
    );
  }
  if (passThreshold > totalMaxScore) {
    throw new ScorecardFormatError(
      `The pass mark (${passThreshold}) is higher than the total available (${totalMaxScore}), ` +
        `so no call could ever pass.`
    );
  }

  return {
    categories,
    aiCategories,
    reviewerCategories: categories.filter((c) => c.scoredBy === "reviewer"),
    aiMaxScore: aiCategories.reduce((sum, c) => sum + c.max, 0),
    totalMaxScore,
    passThreshold,
  };
}
