import {
  AGENDA_HORIZON_DAYS,
  HOME_UPCOMING_LIMIT,
  WEEKDAY_LABELS,
} from "./constants";
import {
  addSchoolDays,
  compareIsoDates,
  formatSchoolDayHeading,
  formatSchoolShortDate,
  formatSchoolTimeLabel,
  isIsoDate,
  isIsoTime,
  schoolAllDayEndIso,
  schoolAllDayStartIso,
  schoolDateIsoFromInstant,
  schoolMonthKey,
  schoolMonthLabel,
  schoolTimeFromInstant,
  schoolTimedInstantIso,
  schoolTodayIso,
} from "./school-timezone";
import type {
  AgendaDayGroup,
  CalendarEvent,
  CalendarEventDraft,
  CalendarNote,
  HomeCalendarEvent,
  MonthCell,
  MonthGrid,
} from "./types";

function weekdayMondayIndex(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utcDay = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return utcDay === 0 ? 6 : utcDay - 1;
}

export function monthFirstDay(monthKey: string): string {
  return `${monthKey}-01`;
}

export function monthLastDay(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return `${monthKey}-${String(last).padStart(2, "0")}`;
}

/** Monday–Sunday month grid with leading/trailing buffer days. */
export function buildMonthGrid(monthKey: string, todayIso = schoolTodayIso()): MonthGrid {
  const first = monthFirstDay(monthKey);
  const last = monthLastDay(monthKey);
  const lead = weekdayMondayIndex(first);
  const rangeStart = addSchoolDays(first, -lead);
  const trail = 6 - weekdayMondayIndex(last);
  const rangeEnd = addSchoolDays(last, trail);

  const weeks: MonthCell[][] = [];
  let cursor = rangeStart;
  while (cursor <= rangeEnd) {
    const week: MonthCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        iso: cursor,
        inMonth: cursor >= first && cursor <= last,
        isToday: cursor === todayIso,
      });
      cursor = addSchoolDays(cursor, 1);
    }
    weeks.push(week);
  }

  return {
    monthKey,
    label: schoolMonthLabel(monthKey),
    weekdayLabels: [...WEEKDAY_LABELS],
    weeks,
    rangeStart,
    rangeEnd,
  };
}

export function eventOverlapsDay(event: Pick<CalendarEvent, "startDate" | "endDate">, isoDate: string): boolean {
  return event.startDate <= isoDate && isoDate <= event.endDate;
}

export function eventOverlapsRange(
  event: Pick<CalendarEvent, "startDate" | "endDate">,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return event.startDate <= rangeEnd && event.endDate >= rangeStart;
}

export function eventsForDay(events: CalendarEvent[], isoDate: string): CalendarEvent[] {
  return events
    .filter((event) => eventOverlapsDay(event, isoDate))
    .sort(compareEvents);
}

export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.startDate !== b.startDate) return compareIsoDates(a.startDate, b.startDate);
  const aTime = a.startTime ?? "00:00";
  const bTime = b.startTime ?? "00:00";
  if (aTime !== bTime) return aTime < bTime ? -1 : 1;
  return a.title.localeCompare(b.title);
}

export function overflowLabel(hiddenCount: number): string {
  return `+${hiddenCount} more`;
}

export function visibleCellEvents(
  events: CalendarEvent[],
  limit: number,
): { shown: CalendarEvent[]; hidden: number } {
  if (events.length <= limit) return { shown: events, hidden: 0 };
  return { shown: events.slice(0, limit), hidden: events.length - limit };
}

/** Place a multi-day event once in agenda — on start, or first visible day if already underway. */
export function agendaPlacementDate(
  event: Pick<CalendarEvent, "startDate" | "endDate">,
  windowStart: string,
): string {
  return event.startDate >= windowStart ? event.startDate : windowStart;
}

export function buildAgendaGroups(args: {
  events: CalendarEvent[];
  notes: CalendarNote[];
  fromIso: string;
  toIso: string;
  todayIso?: string;
}): AgendaDayGroup[] {
  const today = args.todayIso ?? schoolTodayIso();
  const byDate = new Map<string, { events: CalendarEvent[]; notes: CalendarNote[] }>();

  function bucket(iso: string) {
    if (iso < args.fromIso || iso > args.toIso) return null;
    let entry = byDate.get(iso);
    if (!entry) {
      entry = { events: [], notes: [] };
      byDate.set(iso, entry);
    }
    return entry;
  }

  for (const event of args.events) {
    if (!eventOverlapsRange(event, args.fromIso, args.toIso)) continue;
    const date = agendaPlacementDate(event, args.fromIso);
    bucket(date)?.events.push(event);
  }

  for (const note of args.notes) {
    bucket(note.noteDate)?.notes.push(note);
  }

  return [...byDate.entries()]
    .filter(([, group]) => group.events.length > 0 || group.notes.length > 0)
    .sort(([a], [b]) => compareIsoDates(a, b))
    .map(([iso, group]) => ({
      iso,
      label: formatSchoolDayHeading(iso),
      isToday: iso === today,
      events: group.events.sort(compareEvents),
      notes: group.notes.sort((a, b) => a.createdByProfileId.localeCompare(b.createdByProfileId)),
    }));
}

export function upcomingHomeEvents(
  events: CalendarEvent[],
  todayIso = schoolTodayIso(),
  limit = HOME_UPCOMING_LIMIT,
): HomeCalendarEvent[] {
  return events
    .filter((event) => event.endDate >= todayIso)
    .sort(compareEvents)
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      allDay: event.allDay,
      startTime: event.startTime,
      category: event.category,
      audience: event.audience,
    }));
}

export function formatEventWhen(
  event: Pick<CalendarEvent, "startDate" | "endDate" | "allDay" | "startTime" | "endTime">,
  todayIso = schoolTodayIso(),
): string {
  const range =
    event.startDate === event.endDate
      ? event.startDate === todayIso
        ? "Today"
        : formatSchoolShortDate(event.startDate)
      : `${formatSchoolShortDate(event.startDate)}–${formatSchoolShortDate(event.endDate)}`;

  if (event.allDay) return range;
  const start = event.startTime ? formatSchoolTimeLabel(event.startTime) : "";
  const end = event.endTime ? formatSchoolTimeLabel(event.endTime) : "";
  if (start && end) return `${range} · ${start}–${end}`;
  if (start) return `${range} · ${start}`;
  return range;
}

export function formatHomeEventWhen(
  event: HomeCalendarEvent,
  todayIso = schoolTodayIso(),
): string {
  if (event.startDate === event.endDate) {
    const day = event.startDate === todayIso ? "Today" : formatSchoolShortDate(event.startDate);
    if (event.allDay) return day;
    return event.startTime ? `${day} · ${formatSchoolTimeLabel(event.startTime)}` : day;
  }
  if (event.startDate < todayIso && event.endDate >= todayIso) {
    return `Through ${formatSchoolShortDate(event.endDate)}`;
  }
  return `${formatSchoolShortDate(event.startDate)}–${formatSchoolShortDate(event.endDate)}`;
}

export function eventRangeLabel(
  event: Pick<CalendarEvent, "startDate" | "endDate" | "allDay">,
): string {
  if (event.startDate === event.endDate) {
    return event.allDay ? "All day" : formatSchoolShortDate(event.startDate);
  }
  return `${formatSchoolShortDate(event.startDate)} – ${formatSchoolShortDate(event.endDate)}`;
}

export function mapStoredEvent(row: {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  category: CalendarEvent["category"];
  audience: CalendarEvent["audience"];
  location: string | null;
  created_by_profile_id: string;
}): CalendarEvent {
  const start = new Date(row.starts_at);
  const end = new Date(row.ends_at);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    startDate: schoolDateIsoFromInstant(start),
    endDate: schoolDateIsoFromInstant(end),
    startTime: row.all_day ? null : schoolTimeFromInstant(start),
    endTime: row.all_day ? null : schoolTimeFromInstant(end),
    allDay: row.all_day,
    category: row.category,
    audience: row.audience,
    location: row.location,
    createdByProfileId: row.created_by_profile_id,
  };
}

export function instantsFromDraft(draft: Pick<
  CalendarEventDraft,
  "startDate" | "endDate" | "allDay" | "startTime" | "endTime"
>): { startsAt: string; endsAt: string } | { error: string } {
  if (!isIsoDate(draft.startDate)) return { error: "Choose a start date." };
  const endDate = draft.endDate || draft.startDate;
  if (!isIsoDate(endDate)) return { error: "Choose a valid end date." };
  if (endDate < draft.startDate) return { error: "End date can’t be before the start date." };

  if (draft.allDay) {
    return {
      startsAt: schoolAllDayStartIso(draft.startDate),
      endsAt: schoolAllDayEndIso(endDate),
    };
  }

  if (!isIsoTime(draft.startTime)) return { error: "Add a start time." };
  const endTime = draft.endTime || draft.startTime;
  if (!isIsoTime(endTime)) return { error: "Add an end time." };
  if (endDate === draft.startDate && endTime < draft.startTime) {
    return { error: "End time can’t be before the start time." };
  }

  return {
    startsAt: schoolTimedInstantIso(draft.startDate, draft.startTime),
    endsAt: schoolTimedInstantIso(endDate, endTime),
  };
}

export function agendaWindow(todayIso = schoolTodayIso()): { fromIso: string; toIso: string } {
  return {
    fromIso: todayIso,
    toIso: addSchoolDays(todayIso, AGENDA_HORIZON_DAYS),
  };
}

export function notesForDay(notes: CalendarNote[], isoDate: string): CalendarNote[] {
  return notes.filter((note) => note.noteDate === isoDate);
}

export function parseViewParam(value: string | undefined): "month" | "agenda" | undefined {
  if (value === "month" || value === "agenda") return value;
  return undefined;
}

export function calendarHref(
  role: string,
  state: {
    view?: "month" | "agenda";
    month?: string;
    date?: string;
    event?: string;
  } = {},
): string {
  const params = new URLSearchParams();
  if (state.view && state.view !== "month") params.set("view", state.view);
  if (state.month) params.set("month", state.month);
  if (state.date) params.set("date", state.date);
  if (state.event) params.set("event", state.event);
  const q = params.toString();
  return `/dashboard/${role}/calendar${q ? `?${q}` : ""}`;
}

export function monthKeyFromDate(isoDate: string): string {
  return schoolMonthKey(isoDate);
}
