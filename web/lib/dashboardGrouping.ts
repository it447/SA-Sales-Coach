import type { CallSession } from "./types";

export type PeriodFilter = "today" | "7d" | "30d" | "all";

export const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parsePeriod(value: string | string[] | undefined): PeriodFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "today" || v === "7d" || v === "30d" ? v : "all";
}

/** Cutoff a session's startedAt must be >= to pass the filter — null means no filtering (all time). */
export function periodCutoff(period: PeriodFilter, now: Date): Date | null {
  switch (period) {
    case "today":
      return startOfDay(now);
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "all":
      return null;
  }
}

/** Today / Yesterday / a full weekday+date label for anything older. */
function dayBucketLabel(startedAt: string, now: Date): string {
  const started = startOfDay(new Date(startedAt));
  const diffDays = Math.round((startOfDay(now).getTime() - started.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return new Date(startedAt).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Groups sessions (already sorted newest-first) into Today/Yesterday/date buckets, preserving order. */
export function groupSessionsByDay(
  sessions: CallSession[],
  now: Date = new Date()
): { label: string; sessions: CallSession[] }[] {
  const groups: { label: string; sessions: CallSession[] }[] = [];
  for (const session of sessions) {
    const label = dayBucketLabel(session.startedAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.sessions.push(session);
    } else {
      groups.push({ label, sessions: [session] });
    }
  }
  return groups;
}
