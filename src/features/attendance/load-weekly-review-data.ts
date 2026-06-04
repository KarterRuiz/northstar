import "server-only";

import { cache } from "react";

import { loadSchoolYearTermContext } from "@/features/attendance-behavior/load-support-flag-data";
import { loadTeacherWorkspaceData } from "@/features/teacher/dashboard/load-teacher-workspace-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { evaluateAttendanceConcernFromRecords } from "./attendance-concerns";
import { attendancePercent, tallyFromRecords } from "./attendance-metrics";
import {
  previousWeekRange,
  weekdaysInWeek,
  weekRangeContaining,
} from "./attendance-date-utils";
import { compareAttendanceTrend, type AttendanceTrendResult } from "./attendance-trend";
import type { AttendanceStatus } from "./schema";
import { attendanceStatusLabels } from "./schema";

export type WeeklyRosterSummary = {
  studentId: string;
  displayName: string;
  gradeName: string;
  present: number;
  absent: number;
  tardy: number;
  excused: number;
  attendancePct: number | null;
  notesCount: number;
  weeklyPct: number | null;
  trend: AttendanceTrendResult;
  concernFollowUp: string | null;
};

export type WeeklyGridRow = {
  studentId: string;
  displayName: string;
  byDay: Record<string, string | null>;
  weeklyPct: number | null;
};

export type WeeklyReviewData =
  | {
      ok: true;
      classes: { id: string; label: string; schoolYearLabel: string }[];
      classId: string | null;
      weekStart: string;
      weekEnd: string;
      weekdays: string[];
      classTrend: AttendanceTrendResult;
      rosterSummary: WeeklyRosterSummary[];
      weekGrid: WeeklyGridRow[];
    }
  | { ok: false; message: string };

function statusShort(status: string | null): string | null {
  if (!status) return null;
  const label = attendanceStatusLabels[status as AttendanceStatus];
  if (!label) return status;
  return label.split(" ")[0] ?? label;
}

export const loadWeeklyReviewData = cache(async function loadWeeklyReviewData(args: {
  classId: string | null;
  weekStart: string | null;
}): Promise<WeeklyReviewData> {
  const ws = await loadTeacherWorkspaceData();
  if (!ws.ok) return ws;

  const classes = ws.classes
    .filter((c) => c.isActive)
    .map((c) => ({
      id: c.id,
      label: [c.name, c.section, c.gradeName].filter(Boolean).join(" · "),
      schoolYearLabel: c.schoolYearLabel,
    }));

  const classId =
    args.classId && classes.some((c) => c.id === args.classId)
      ? args.classId
      : classes[0]?.id ?? null;

  const anchor = args.weekStart ?? new Date().toISOString().slice(0, 10);
  const { start: weekStart, end: weekEnd } = weekRangeContaining(anchor);
  const { start: prevWeekStart, end: prevWeekEnd } = previousWeekRange(weekStart);
  const weekdays = weekdaysInWeek(weekStart);

  if (!classId) {
    return {
      ok: true,
      classes,
      classId: null,
      weekStart,
      weekEnd,
      weekdays,
      classTrend: null,
      rosterSummary: [],
      weekGrid: [],
    };
  }

  const selectedClass = classes.find((c) => c.id === classId)!;
  const rosterBase = ws.roster.filter((r) => r.classId === classId);
  rosterBase.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
  );

  const termCtx = await loadSchoolYearTermContext();
  let records: {
    student_id: string;
    attendance_date: string;
    status: string;
    notes: string | null;
  }[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("attendance_records")
      .select("student_id, attendance_date, status, notes")
      .eq("class_id", classId)
      .eq("school_year", selectedClass.schoolYearLabel)
      .gte("attendance_date", prevWeekStart)
      .lte("attendance_date", weekEnd);

    if (error) return { ok: false, message: error.message };
    records = (data ?? []) as typeof records;
  }

  let termRecords: typeof records = [];
  if (termCtx.ok && isSupabaseConfigured() && rosterBase.length > 0) {
    const supabase = await createServerSupabaseClient();
    const studentIds = rosterBase.map((r) => r.studentId);
    const { data } = await supabase
      .from("attendance_records")
      .select("student_id, attendance_date, status, notes")
      .eq("class_id", classId)
      .eq("school_year", selectedClass.schoolYearLabel)
      .in("student_id", studentIds)
      .gte("attendance_date", termCtx.termStart)
      .lte("attendance_date", termCtx.termEnd);
    termRecords = (data ?? []) as typeof records;
  }

  const currentWeekRecords = records.filter(
    (row) => row.attendance_date >= weekStart && row.attendance_date <= weekEnd,
  );
  const previousWeekRecords = records.filter(
    (row) => row.attendance_date >= prevWeekStart && row.attendance_date <= prevWeekEnd,
  );

  const classWeekTally = tallyFromRecords(
    currentWeekRecords.map((row) => ({ status: row.status, notes: row.notes })),
  );
  const classPrevWeekTally = tallyFromRecords(
    previousWeekRecords.map((row) => ({ status: row.status, notes: row.notes })),
  );
  const classTrend = compareAttendanceTrend(
    attendancePercent(classWeekTally),
    attendancePercent(classPrevWeekTally),
  );

  const rosterSummary: WeeklyRosterSummary[] = rosterBase.map((r) => {
    const weekRows = currentWeekRecords
      .filter((row) => row.student_id === r.studentId)
      .map((row) => ({
        attendanceDate: row.attendance_date,
        status: row.status,
        notes: row.notes,
      }));
    const weekTally = tallyFromRecords(weekRows);
    const prevWeekRows = previousWeekRecords
      .filter((row) => row.student_id === r.studentId)
      .map((row) => ({ status: row.status }));
    const prevWeekTally = tallyFromRecords(prevWeekRows);
    const termRows = termRecords
      .filter((row) => row.student_id === r.studentId)
      .map((row) => ({ attendanceDate: row.attendance_date, status: row.status }));
    const concern =
      termCtx.ok
        ? evaluateAttendanceConcernFromRecords(
            termRows,
            termCtx.termStart,
            termCtx.termEnd,
            weekEnd,
          )
        : null;

    return {
      studentId: r.studentId,
      displayName: r.displayName,
      gradeName: r.gradeName,
      present: weekTally.present,
      absent: weekTally.absent,
      tardy: weekTally.tardy,
      excused: weekTally.excused,
      attendancePct: attendancePercent(weekTally),
      notesCount: weekTally.notesCount,
      weeklyPct: attendancePercent(weekTally),
      trend: compareAttendanceTrend(
        attendancePercent(weekTally),
        attendancePercent(prevWeekTally),
      ),
      concernFollowUp: concern?.followUp ?? null,
    };
  });

  const weekGrid: WeeklyGridRow[] = rosterBase.map((r) => {
    const byDay: Record<string, string | null> = {};
    for (const day of weekdays) {
      const row = currentWeekRecords.find(
        (rec) => rec.student_id === r.studentId && rec.attendance_date === day,
      );
      byDay[day] = statusShort(row?.status ?? null);
    }
    const weekRows = currentWeekRecords
      .filter((row) => row.student_id === r.studentId)
      .map((row) => ({ status: row.status }));
    const weekTally = tallyFromRecords(weekRows);
    return {
      studentId: r.studentId,
      displayName: r.displayName,
      byDay,
      weeklyPct: attendancePercent(weekTally),
    };
  });

  return {
    ok: true,
    classes,
    classId,
    weekStart,
    weekEnd,
    weekdays,
    classTrend,
    rosterSummary,
    weekGrid,
  };
});
