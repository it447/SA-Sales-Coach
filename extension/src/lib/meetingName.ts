/**
 * Google Meet tab/document titles are either the calendar event name
 * (unsuffixed) or just "Meet" for an ad-hoc call with no name — strip the
 * latter down to null so the dashboard falls back to its own role-derived
 * label instead of showing the meaningless word "Meet". Shared by the popup
 * (reads the tab title) and the content script (reads document.title
 * directly, since it runs on the page itself).
 */
export function meetingNameFromTitle(title: string | undefined): string | null {
  const trimmed = title?.trim();
  if (!trimmed || trimmed === "Meet") return null;
  return trimmed;
}

/**
 * Sales calls at Scale Army follow a fixed calendar-invite naming
 * convention ("Carlos Marchani <> Scale Army: Intro Meeting", "Intro Call -
 * Marketing between Joe Ali and Shah") -- this checks the tab title for
 * that convention so the content script can stay fully inert (no
 * auto-created session, no captions auto-enabled) on internal meetings,
 * which live on the same meet.google.com domain and would otherwise
 * trigger identically. Case-insensitive substring match, deliberately
 * loose -- the goal is "does this look like a sales call", not exact
 * parsing.
 */
export function isSalesCallTitle(title: string | undefined): boolean {
  const trimmed = title?.trim().toLowerCase();
  if (!trimmed) return false;
  return trimmed.includes("intro call") || trimmed.includes("intro meeting");
}
