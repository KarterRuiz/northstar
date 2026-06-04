import { formatInterventionDate } from "./format-intervention-date";
import { addSchoolDays, parseIsoDateOnly, startOfLocalDay, toIsoDateString } from "./school-days";

/** Follow-ups on or before today + this many school days count as "due soon". */
export const FOLLOW_UP_DUE_SOON_SCHOOL_DAYS = 2;

export type FollowUpTimelineStatus = "none" | "scheduled" | "overdue";

export type FollowUpDashboardStatus = FollowUpTimelineStatus | "due_soon";

export function getFollowUpTimelineStatus(
  followUpDate: string | null,
  today: Date = new Date(),
): FollowUpTimelineStatus {
  if (!followUpDate) return "none";
  const due = parseIsoDateOnly(followUpDate);
  if (!due) return "none";
  const todayStart = startOfLocalDay(today);
  if (due.getTime() < todayStart.getTime()) return "overdue";
  return "scheduled";
}

export function getFollowUpDashboardStatus(
  followUpDate: string | null,
  today: Date = new Date(),
): FollowUpDashboardStatus {
  const timeline = getFollowUpTimelineStatus(followUpDate, today);
  if (timeline === "none" || timeline === "overdue") return timeline;
  const due = parseIsoDateOnly(followUpDate!);
  if (!due) return "none";
  const todayStart = startOfLocalDay(today);
  const dueSoonCutoff = addSchoolDays(todayStart, FOLLOW_UP_DUE_SOON_SCHOOL_DAYS);
  if (due.getTime() <= dueSoonCutoff.getTime()) return "due_soon";
  return "scheduled";
}

export function isFollowUpActionable(
  followUpDate: string | null,
  today: Date = new Date(),
): boolean {
  const status = getFollowUpDashboardStatus(followUpDate, today);
  return status === "overdue" || status === "due_soon";
}

export function followUpTimelineLabel(
  followUpDate: string | null,
  today: Date = new Date(),
): string {
  const status = getFollowUpTimelineStatus(followUpDate, today);
  if (status === "none") return "No follow-up scheduled";
  if (status === "overdue") {
    return `Follow-up overdue · ${formatInterventionDate(followUpDate)}`;
  }
  return `Follow-up scheduled · ${formatInterventionDate(followUpDate)}`;
}

export function todayIsoDate(): string {
  return toIsoDateString(startOfLocalDay(new Date()));
}
