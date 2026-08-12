import type { EventAudience, EventCategory } from "./types";

export const SCHOOL_TIMEZONE = "Asia/Shanghai";
/** Shanghai has no DST — wall times are always UTC+8. */
export const SCHOOL_UTC_OFFSET = "+08:00";

export const HOME_UPCOMING_LIMIT = 3;
export const AGENDA_HORIZON_DAYS = 56;
export const MONTH_CELL_EVENT_LIMIT = 3;
export const MONTH_CELL_EVENT_LIMIT_NARROW = 2;

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  school: "School",
  meeting: "Meeting",
  academic: "Academic",
  reporting: "Reporting",
  pd: "PD",
  event: "Event",
  deadline: "Deadline",
};

export const EVENT_AUDIENCE_LABELS: Record<EventAudience, string> = {
  leadership: "Leadership",
  all_staff: "All Staff",
  whole_school: "Whole School",
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const CALENDAR_EMPTY = {
  month: "No events this month.",
  agenda: "No upcoming events.",
  home: "No upcoming events.",
  homeTeacher: "No upcoming school events.",
  dayEvents: "No events on this day.",
  dayNotes: "No leadership notes for this day.",
} as const;

export const CALENDAR_PARTIAL_LOAD =
  "Some calendar items could not be loaded right now.";

export const CALENDAR_SUBTITLE =
  "School events, important dates, and leadership notes in one place.";

export const CALENDAR_SUBTITLE_TEACHER = "School and staff events.";
