export const EVENT_CATEGORIES = [
  "school",
  "meeting",
  "academic",
  "reporting",
  "pd",
  "event",
  "deadline",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_AUDIENCES = [
  "leadership",
  "all_staff",
  "whole_school",
] as const;

export type EventAudience = (typeof EVENT_AUDIENCES)[number];

export const CALENDAR_VIEWS = ["month", "agenda"] as const;

export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  category: EventCategory;
  audience: EventAudience;
  location: string | null;
  createdByProfileId: string;
};

export type CalendarNoteRelated = {
  staffMemberId: string | null;
  staffLabel: string | null;
  studentId: string | null;
  studentLabel: string | null;
  classId: string | null;
  classLabel: string | null;
};

export type CalendarNote = {
  id: string;
  note: string;
  noteDate: string;
  createdByProfileId: string;
  related: CalendarNoteRelated;
};

export type HomeCalendarEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string | null;
  category: EventCategory;
  audience: EventAudience;
};

export type MonthCell = {
  iso: string;
  inMonth: boolean;
  isToday: boolean;
};

export type MonthGrid = {
  monthKey: string;
  label: string;
  weekdayLabels: string[];
  weeks: MonthCell[][];
  rangeStart: string;
  rangeEnd: string;
};

export type AgendaDayGroup = {
  iso: string;
  label: string;
  isToday: boolean;
  events: CalendarEvent[];
  notes: CalendarNote[];
};

export type CalendarEventDraft = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  category: EventCategory;
  audience: EventAudience;
  location: string;
};

export type CalendarHrefState = {
  view?: CalendarView;
  month?: string;
  date?: string;
  event?: string;
};
