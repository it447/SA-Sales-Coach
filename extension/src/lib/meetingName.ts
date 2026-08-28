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
