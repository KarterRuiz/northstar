import "server-only";

import type { Role } from "@/config/roles";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  agendaWindow,
  buildMonthGrid,
  mapStoredEvent,
} from "./calendar-range";
import { CALENDAR_PARTIAL_LOAD } from "./constants";
import {
  isIsoDate,
  parseMonthKey,
  schoolAllDayEndIso,
  schoolAllDayStartIso,
  schoolMonthKey,
  schoolTodayIso,
} from "./school-timezone";
import type {
  CalendarEvent,
  CalendarNote,
  CalendarView,
  MonthGrid,
} from "./types";
import {
  canManageCalendarEvents,
  canViewCalendarNotes,
  visibleEventsForRole,
} from "./visibility";

export type CalendarWorkspaceData = {
  view: CalendarView;
  viewExplicit: boolean;
  todayIso: string;
  monthKey: string;
  selectedDate: string | null;
  selectedEventId: string | null;
  grid: MonthGrid;
  events: CalendarEvent[];
  notes: CalendarNote[];
  canManageEvents: boolean;
  canManageNotes: boolean;
  error: string | null;
};

function firstString(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function emptyNoteRelated(): CalendarNote["related"] {
  return {
    staffMemberId: null,
    staffLabel: null,
    studentId: null,
    studentLabel: null,
    classId: null,
    classLabel: null,
  };
}

export function parseCalendarSearchParams(
  raw: Record<string, string | string[] | undefined>,
  todayIso = schoolTodayIso(),
): {
  view: CalendarView;
  viewExplicit: boolean;
  monthKey: string;
  selectedDate: string | null;
  selectedEventId: string | null;
} {
  const viewRaw = firstString(raw.view);
  const viewExplicit = viewRaw === "agenda" || viewRaw === "month";
  const view: CalendarView = viewRaw === "agenda" ? "agenda" : "month";
  const monthKey = parseMonthKey(firstString(raw.month), todayIso);
  const dateRaw = firstString(raw.date);
  const selectedDate = dateRaw && isIsoDate(dateRaw) ? dateRaw : null;
  const eventRaw = firstString(raw.event);
  const selectedEventId = eventRaw?.trim() ? eventRaw.trim() : null;
  return { view, viewExplicit, monthKey, selectedDate, selectedEventId };
}

export async function loadCalendarWorkspace(
  role: Role,
  raw: Record<string, string | string[] | undefined>,
): Promise<CalendarWorkspaceData> {
  const todayIso = schoolTodayIso();
  const parsed = parseCalendarSearchParams(raw, todayIso);
  const grid = buildMonthGrid(parsed.monthKey, todayIso);
  const canManageNotes = canViewCalendarNotes(role);
  const canManageEvents = canManageCalendarEvents(role);
  const empty: CalendarWorkspaceData = {
    ...parsed,
    todayIso,
    grid,
    events: [],
    notes: [],
    canManageEvents,
    canManageNotes,
    error: null,
  };

  if (!isSupabaseConfigured()) {
    return { ...empty, error: GENERIC_INFORMATION_LOAD_ERROR };
  }

  const agenda = agendaWindow(todayIso);
  const rangeStart =
    grid.rangeStart < agenda.fromIso ? grid.rangeStart : agenda.fromIso;
  const rangeEnd = grid.rangeEnd > agenda.toIso ? grid.rangeEnd : agenda.toIso;
  const fromIso = schoolAllDayStartIso(rangeStart);
  const toIso = schoolAllDayEndIso(rangeEnd);

  const supabase = await createServerSupabaseClient();

  const eventsQuery = supabase
    .from("school_events")
    .select(
      "id, title, description, starts_at, ends_at, all_day, category, audience, location, created_by_profile_id",
    )
    .is("archived_at", null)
    .lte("starts_at", toIso)
    .gte("ends_at", fromIso)
    .order("starts_at", { ascending: true });

  const notesQuery = canManageNotes
    ? supabase
        .from("calendar_notes")
        .select(
          "id, note, note_date, created_by_profile_id, related_staff_member_id, related_student_id, related_class_id",
        )
        .gte("note_date", rangeStart)
        .lte("note_date", rangeEnd)
        .order("note_date", { ascending: true })
    : null;

  const [eventsRes, notesRes] = await Promise.all([
    eventsQuery,
    notesQuery ?? Promise.resolve({ data: [], error: null }),
  ]);

  let error: string | null = null;
  if (eventsRes.error) {
    logServerError("calendar.loadEvents", eventsRes.error.message);
    error = CALENDAR_PARTIAL_LOAD;
  }
  if (notesRes.error) {
    logServerError("calendar.loadNotes", notesRes.error.message);
    error = CALENDAR_PARTIAL_LOAD;
  }

  const events = visibleEventsForRole(
    role,
    (eventsRes.data ?? []).map(mapStoredEvent),
  );

  const noteRows = notesRes.data ?? [];
  const staffIds = [
    ...new Set(
      noteRows
        .map((row) => row.related_staff_member_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const studentIds = [
    ...new Set(
      noteRows
        .map((row) => row.related_student_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const classIds = [
    ...new Set(
      noteRows
        .map((row) => row.related_class_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [staffRes, studentRes, classRes] = await Promise.all([
    staffIds.length
      ? supabase.from("staff_members").select("id, full_name").in("id", staffIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase
          .from("students")
          .select("id, first_name, last_name, preferred_name")
          .in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    classIds.length
      ? supabase.from("classes").select("id, name").in("id", classIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (staffRes.error || studentRes.error || classRes.error) {
    logServerError(
      "calendar.loadNoteRelated",
      staffRes.error?.message ?? studentRes.error?.message ?? classRes.error?.message,
    );
    error = CALENDAR_PARTIAL_LOAD;
  }

  const staffNames = new Map(
    (staffRes.data ?? []).map((row) => [row.id, row.full_name]),
  );
  const studentNames = new Map(
    (studentRes.data ?? []).map((row) => {
      const pref = row.preferred_name?.trim();
      const name =
        pref ||
        [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
        "Student";
      return [row.id, name] as const;
    }),
  );
  const classNames = new Map((classRes.data ?? []).map((row) => [row.id, row.name]));

  const notes: CalendarNote[] = noteRows.map((row) => ({
    id: row.id,
    note: row.note,
    noteDate: row.note_date,
    createdByProfileId: row.created_by_profile_id,
    related: {
      ...emptyNoteRelated(),
      staffMemberId: row.related_staff_member_id,
      staffLabel: row.related_staff_member_id
        ? (staffNames.get(row.related_staff_member_id) ?? null)
        : null,
      studentId: row.related_student_id,
      studentLabel: row.related_student_id
        ? (studentNames.get(row.related_student_id) ?? null)
        : null,
      classId: row.related_class_id,
      classLabel: row.related_class_id
        ? (classNames.get(row.related_class_id) ?? null)
        : null,
    },
  }));

  return {
    ...parsed,
    todayIso,
    grid,
    events,
    notes,
    canManageEvents,
    canManageNotes,
    error,
  };
}

export function defaultMonthKey(todayIso = schoolTodayIso()): string {
  return schoolMonthKey(todayIso);
}
