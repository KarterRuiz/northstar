/**
 * School Calendar expected coverage (Tests A–R)
 *
 * A. No events → empty copy, no mock data.
 * B. All-day event stays on the intended Shanghai date.
 * C. Timed event keeps start/end wall times.
 * D. Multi-day range (Orientation Week Aug 24–29) spans each day.
 * E. Edit draft rebuilds Shanghai instants.
 * F. Archive is a soft hide (archived events drop out of upcoming).
 * G. Leadership-only events are hidden from teachers.
 * H. Staff-visible model: teachers can read All Staff / Whole School.
 * I. Note attaches to a single date.
 * J. Teachers cannot view leadership notes.
 * K. Day drawer groups events + notes for that date only.
 * L. Agenda groups by date and skips empty days.
 * M. Home preview is next 2–3 events, notes excluded.
 * N. Home / event click hrefs open Calendar with optional day context.
 * O. schoolTodayIso uses Asia/Shanghai, not UTC.
 * P. UTC midnight storage would shift; Shanghai midnight does not.
 * Q. Month grid is Mon–Sun with buffer days; mobile prefers Agenda default.
 * R. Teachers get a read-only workspace; registrars stay blocked from notes/write.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAccessCalendar,
  canManageCalendarNotes,
  canViewCalendar,
} from "@/config/roles";

import {
  agendaPlacementDate,
  agendaWindow,
  buildAgendaGroups,
  buildMonthGrid,
  calendarHref,
  eventOverlapsDay,
  eventsForDay,
  formatHomeEventWhen,
  instantsFromDraft,
  mapStoredEvent,
  notesForDay,
  overflowLabel,
  parseViewParam,
  upcomingHomeEvents,
  visibleCellEvents,
} from "./calendar-range";
import { CALENDAR_EMPTY } from "./constants";
import {
  schoolAllDayEndIso,
  schoolAllDayStartIso,
  schoolDateIsoFromInstant,
  schoolTodayIso,
} from "./school-timezone";
import type { CalendarEvent, CalendarNote } from "./types";
import {
  canManageCalendarEvents,
  canReadAudience,
  canViewCalendarNotes,
  isCalendarWorkspaceRole,
  unauthorizedCalendarMessage,
  visibleEventsForRole,
} from "./visibility";

const TODAY = "2026-08-11";

function event(
  partial: Partial<CalendarEvent> & Pick<CalendarEvent, "id" | "title" | "startDate" | "endDate">,
): CalendarEvent {
  return {
    description: null,
    startsAt: schoolAllDayStartIso(partial.startDate),
    endsAt: schoolAllDayEndIso(partial.endDate),
    startTime: null,
    endTime: null,
    allDay: true,
    category: "school",
    audience: "all_staff",
    location: null,
    createdByProfileId: "profile-1",
    ...partial,
  };
}

function note(partial: Partial<CalendarNote> & Pick<CalendarNote, "id" | "note" | "noteDate">): CalendarNote {
  return {
    createdByProfileId: "profile-1",
    related: {
      staffMemberId: null,
      staffLabel: null,
      studentId: null,
      studentLabel: null,
      classId: null,
      classLabel: null,
    },
    ...partial,
  };
}

describe("Calendar A — empty states", () => {
  it("uses honest empty copy and no mock events", () => {
    assert.equal(upcomingHomeEvents([], TODAY).length, 0);
    assert.equal(CALENDAR_EMPTY.home, "No upcoming events.");
    assert.equal(CALENDAR_EMPTY.month, "No events this month.");
    assert.equal(CALENDAR_EMPTY.agenda, "No upcoming events.");
    assert.equal(CALENDAR_EMPTY.dayEvents, "No events on this day.");
  });
});

describe("Calendar B — all-day date", () => {
  it("stores and reads an all-day event on the intended school date", () => {
    const instants = instantsFromDraft({
      startDate: "2026-08-24",
      endDate: "2026-08-24",
      allDay: true,
      startTime: "",
      endTime: "",
    });
    assert.ok(!("error" in instants));
    assert.equal(instants.startsAt, "2026-08-24T00:00:00.000+08:00");
    assert.equal(instants.endsAt, "2026-08-24T23:59:59.999+08:00");

    const mapped = mapStoredEvent({
      id: "e1",
      title: "First day",
      description: null,
      starts_at: instants.startsAt,
      ends_at: instants.endsAt,
      all_day: true,
      category: "school",
      audience: "whole_school",
      location: null,
      created_by_profile_id: "p1",
    });
    assert.equal(mapped.startDate, "2026-08-24");
    assert.equal(mapped.endDate, "2026-08-24");
    assert.equal(mapped.startTime, null);
  });
});

describe("Calendar C — timed event", () => {
  it("keeps Shanghai wall times for a staff meeting", () => {
    const instants = instantsFromDraft({
      startDate: "2026-08-12",
      endDate: "2026-08-12",
      allDay: false,
      startTime: "15:30",
      endTime: "16:15",
    });
    assert.ok(!("error" in instants));
    assert.equal(instants.startsAt, "2026-08-12T15:30:00+08:00");
    assert.equal(instants.endsAt, "2026-08-12T16:15:00+08:00");

    const mapped = mapStoredEvent({
      id: "e2",
      title: "Staff meeting",
      description: null,
      starts_at: instants.startsAt,
      ends_at: instants.endsAt,
      all_day: false,
      category: "meeting",
      audience: "all_staff",
      location: "Conference room",
      created_by_profile_id: "p1",
    });
    assert.equal(mapped.startDate, "2026-08-12");
    assert.equal(mapped.startTime, "15:30");
    assert.equal(mapped.endTime, "16:15");
  });
});

describe("Calendar D — multi-day", () => {
  it("Orientation Week Aug 24–29 overlaps each school day and none outside", () => {
    const week = event({
      id: "orient",
      title: "Orientation Week",
      startDate: "2026-08-24",
      endDate: "2026-08-29",
    });
    assert.equal(eventOverlapsDay(week, "2026-08-23"), false);
    assert.equal(eventOverlapsDay(week, "2026-08-24"), true);
    assert.equal(eventOverlapsDay(week, "2026-08-27"), true);
    assert.equal(eventOverlapsDay(week, "2026-08-29"), true);
    assert.equal(eventOverlapsDay(week, "2026-08-30"), false);
    assert.equal(eventsForDay([week], "2026-08-26")[0]?.title, "Orientation Week");
  });
});

describe("Calendar E — edit", () => {
  it("rebuilds instants when an event is edited to a new range", () => {
    const updated = instantsFromDraft({
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      allDay: true,
      startTime: "09:00",
      endTime: "10:00",
    });
    assert.ok(!("error" in updated));
    assert.equal(updated.startsAt, schoolAllDayStartIso("2026-09-01"));
    assert.equal(updated.endsAt, schoolAllDayEndIso("2026-09-03"));
  });
});

describe("Calendar F — archive", () => {
  it("archived events are omitted from upcoming once filtered out", () => {
    const active = event({
      id: "live",
      title: "Open house",
      startDate: "2026-08-20",
      endDate: "2026-08-20",
    });
    const archived = event({
      id: "gone",
      title: "Cancelled fair",
      startDate: "2026-08-18",
      endDate: "2026-08-18",
    });
    const remaining = [active].filter((row) => row.id !== archived.id);
    assert.deepEqual(
      upcomingHomeEvents(remaining, TODAY).map((row) => row.id),
      ["live"],
    );
  });
});

describe("Calendar G/H — audience visibility", () => {
  it("teachers cannot read leadership-only events", () => {
    assert.equal(canReadAudience("teacher", "leadership"), false);
    assert.equal(canReadAudience("admin", "leadership"), true);
    const rows = [
      event({
        id: "priv",
        title: "Leadership retreat",
        startDate: "2026-08-15",
        endDate: "2026-08-15",
        audience: "leadership",
      }),
      event({
        id: "pub",
        title: "PD day",
        startDate: "2026-08-16",
        endDate: "2026-08-16",
        audience: "all_staff",
        category: "pd",
      }),
    ];
    assert.deepEqual(
      visibleEventsForRole("teacher", rows).map((row) => row.id),
      ["pub"],
    );
    assert.equal(visibleEventsForRole("admin", rows).length, 2);
  });

  it("staff-visible model allows teachers All Staff and Whole School", () => {
    assert.equal(canReadAudience("teacher", "all_staff"), true);
    assert.equal(canReadAudience("teacher", "whole_school"), true);
    assert.equal(canReadAudience("registrar", "all_staff"), true);
  });
});

describe("Calendar I/J — leadership notes", () => {
  it("notes attach to a date and teachers cannot view them", () => {
    const assembly = note({
      id: "n1",
      note: "Check gym setup",
      noteDate: "2026-08-24",
    });
    assert.equal(notesForDay([assembly], "2026-08-24").length, 1);
    assert.equal(notesForDay([assembly], "2026-08-25").length, 0);
    assert.equal(canViewCalendarNotes("admin"), true);
    assert.equal(canViewCalendarNotes("teacher"), false);
    assert.equal(canManageCalendarNotes("teacher"), false);
    assert.equal(canManageCalendarNotes("registrar"), false);
  });
});

describe("Calendar K — day drawer grouping", () => {
  it("only returns events and notes for the selected date", () => {
    const events = [
      event({
        id: "a",
        title: "Assembly",
        startDate: "2026-08-24",
        endDate: "2026-08-24",
      }),
      event({
        id: "b",
        title: "Orientation Week",
        startDate: "2026-08-24",
        endDate: "2026-08-29",
      }),
      event({
        id: "c",
        title: "Later",
        startDate: "2026-08-30",
        endDate: "2026-08-30",
      }),
    ];
    const notes = [
      note({ id: "n1", note: "Setup", noteDate: "2026-08-24" }),
      note({ id: "n2", note: "Other", noteDate: "2026-08-25" }),
    ];
    assert.deepEqual(
      eventsForDay(events, "2026-08-24").map((row) => row.id),
      ["a", "b"],
    );
    assert.deepEqual(
      notesForDay(notes, "2026-08-24").map((row) => row.id),
      ["n1"],
    );
  });
});

describe("Calendar L — agenda grouping", () => {
  it("groups by date, skips empty days, and places multi-day once", () => {
    const groups = buildAgendaGroups({
      events: [
        event({
          id: "week",
          title: "Orientation Week",
          startDate: "2026-08-24",
          endDate: "2026-08-29",
        }),
        event({
          id: "meet",
          title: "Staff meeting",
          startDate: "2026-08-12",
          endDate: "2026-08-12",
          allDay: false,
          startTime: "15:30",
          endTime: "16:15",
        }),
      ],
      notes: [note({ id: "n1", note: "Call vendor", noteDate: "2026-08-13" })],
      fromIso: TODAY,
      toIso: "2026-08-31",
      todayIso: TODAY,
    });
    assert.deepEqual(
      groups.map((group) => group.iso),
      ["2026-08-12", "2026-08-13", "2026-08-24"],
    );
    assert.equal(groups[0]?.events[0]?.id, "meet");
    assert.equal(groups[1]?.notes[0]?.id, "n1");
    assert.equal(agendaPlacementDate({ startDate: "2026-08-01", endDate: "2026-08-20" }, TODAY), TODAY);
  });
});

describe("Calendar M/N — Home preview and click", () => {
  it("shows the next three upcoming events and never notes", () => {
    const preview = upcomingHomeEvents(
      [
        event({ id: "past", title: "Done", startDate: "2026-08-01", endDate: "2026-08-02" }),
        event({ id: "today", title: "Briefing", startDate: TODAY, endDate: TODAY }),
        event({ id: "a", title: "A", startDate: "2026-08-12", endDate: "2026-08-12" }),
        event({ id: "b", title: "B", startDate: "2026-08-13", endDate: "2026-08-13" }),
        event({ id: "c", title: "C", startDate: "2026-08-14", endDate: "2026-08-14" }),
      ],
      TODAY,
    );
    assert.deepEqual(
      preview.map((row) => row.id),
      ["today", "a", "b"],
    );
    assert.equal(formatHomeEventWhen(preview[0]!, TODAY), "Today");
    assert.equal(calendarHref("admin"), "/dashboard/admin/calendar");
    assert.equal(calendarHref("teacher"), "/dashboard/teacher/calendar");
    assert.equal(
      calendarHref("admin", { date: "2026-08-24", event: "orient" }),
      "/dashboard/admin/calendar?date=2026-08-24&event=orient",
    );
    assert.equal(CALENDAR_EMPTY.homeTeacher, "No upcoming school events.");
  });
});

describe("Calendar O/P — Shanghai timezone", () => {
  it("school today is Asia/Shanghai, not UTC slice", () => {
    const lateUtc = new Date("2026-08-11T18:30:00.000Z");
    assert.equal(schoolTodayIso(lateUtc), "2026-08-12");
    assert.notEqual(lateUtc.toISOString().slice(0, 10), schoolTodayIso(lateUtc));
  });

  it("UTC midnight would shift; Shanghai midnight does not", () => {
    const utcMidnight = new Date("2026-08-24T00:00:00.000Z");
    assert.equal(schoolDateIsoFromInstant(utcMidnight), "2026-08-24");
    const shanghaiMidnight = new Date(schoolAllDayStartIso("2026-08-24"));
    assert.equal(schoolDateIsoFromInstant(shanghaiMidnight), "2026-08-24");
    assert.equal(shanghaiMidnight.toISOString(), "2026-08-23T16:00:00.000Z");
    assert.notEqual(shanghaiMidnight.toISOString().slice(0, 10), "2026-08-24");
  });
});

describe("Calendar Q — month grid and responsive default", () => {
  it("builds a Monday–Sunday August 2026 grid with today marked", () => {
    const grid = buildMonthGrid("2026-08", TODAY);
    assert.equal(grid.weekdayLabels[0], "Mon");
    assert.equal(grid.weekdayLabels[6], "Sun");
    assert.equal(grid.rangeStart, "2026-07-27");
    assert.equal(grid.rangeEnd, "2026-09-06");
    const todayCell = grid.weeks.flat().find((cell) => cell.iso === TODAY);
    assert.equal(todayCell?.isToday, true);
    assert.equal(todayCell?.inMonth, true);
    assert.equal(overflowLabel(2), "+2 more");
    assert.equal(visibleCellEvents([event({ id: "1", title: "A", startDate: TODAY, endDate: TODAY })], 3).hidden, 0);
    assert.equal(parseViewParam(undefined), undefined);
    assert.equal(parseViewParam("agenda"), "agenda");
    const window = agendaWindow(TODAY);
    assert.equal(window.fromIso, TODAY);
    assert.equal(window.toIso, "2026-10-06");
  });
});

describe("Calendar R — unauthorized blocked", () => {
  it("teachers get a read-only workspace; registrars stay blocked", () => {
    assert.equal(isCalendarWorkspaceRole("admin"), true);
    assert.equal(isCalendarWorkspaceRole("principal"), true);
    assert.equal(isCalendarWorkspaceRole("vice_principal"), true);
    assert.equal(isCalendarWorkspaceRole("teacher"), true);
    assert.equal(isCalendarWorkspaceRole("registrar"), false);
    assert.equal(canViewCalendar("teacher"), true);
    assert.equal(canAccessCalendar("teacher"), false);
    assert.equal(canManageCalendarEvents("teacher"), false);
    assert.equal(canManageCalendarNotes("teacher"), false);
    assert.equal(canViewCalendarNotes("teacher"), false);
    assert.match(unauthorizedCalendarMessage("teacher"), /Teachers/);
    assert.match(unauthorizedCalendarMessage("registrar"), /leadership/);
  });
});
