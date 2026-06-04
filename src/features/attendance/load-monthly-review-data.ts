import "server-only";

import { cache } from "react";

import { loadSchoolYearTermContext } from "@/features/attendance-behavior/load-support-flag-data";
import { loadTeacherWorkspaceData } from "@/features/teacher/dashboard/load-teacher-workspace-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { evaluateAttendanceConcernFromRecords } from "./attendance-concerns";
import { attendancePercent, statusCountsInRange } from "./attendance-metrics";
import { monthRangeContaining, previousMonthRange } from "./attendance-date-utils";
import { compareAttendanceTrend, type AttendanceTrendResult } from "./attendance-trend";

export type MonthlyStudentSummary = {
  studentId: string;
  displayName: string;
  gradeName: string;
  daysMarked: number;
  absences: number;
  tardies: number;
  excused: number;
  attendancePct: number | null;
  trend: AttendanceTrendResult;
  highlight: boolean;
  concernFollowUp: string | null;
};

export type MonthlyReviewData =
  | {
      ok: true;
      classes: { id: string; label: string; schoolYearLabel: string }[];
      classId: string | null;
      monthStart: string;
      monthEnd: string;
      monthLabel: string;
      summary: {
        daysMarked: number;
        absences: number;
        tardies: number;
        excused: number;
        attendancePct: number | null;
        trend: AttendanceTrendResult;
      };
      students: MonthlyStudentSummary[];
    }
  | { ok: false; message: string };

export const loadMonthlyReviewData = cache(async function loadMonthlyReviewData(args: {
  classId: string | null;
  month: string | null;
}): Promise<MonthlyReviewData> {
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

  const anchor = args.month ? `${args.month}-01` : new Date().toISOString().slice(0, 10);
  const { start: monthStart, end: monthEnd } = monthRangeContaining(anchor);
  const { start: prevMonthStart, end: prevMonthEnd } = previousMonthRange(monthStart);
  const monthLabel = monthStart.slice(0, 7);

  if (!classId) {
    return {
      ok: true,
      classes,
      classId: null,
      monthStart,
      monthEnd,
      monthLabel,
      summary: {
        daysMarked: 0,
        absences: 0,
        tardies: 0,
        excused: 0,
        attendancePct: null,
        trend: null,
      },
      students: [],
    };
  }

  const selectedClass = classes.find((c) => c.id === classId)!;
  const rosterBase = ws.roster.filter((r) => r.classId === classId);
  rosterBase.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
  );

  let records: {
    student_id: string;
    attendance_date: string;
    status: string;
  }[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("attendance_records")
      .select("student_id, attendance_date, status")
      .eq("class_id", classId)
      .eq("school_year", selectedClass.schoolYearLabel)
      .gte("attendance_date", prevMonthStart)
      .lte("attendance_date", monthEnd);

    if (error) return { ok: false, message: error.message };
    records = (data ?? []) as typeof records;
  }

  const termCtx = await loadSchoolYearTermContext();
  let termRecords: typeof records = [];
  if (termCtx.ok && isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("attendance_records")
      .select("student_id, attendance_date, status")
      .eq("class_id", classId)
      .eq("school_year", selectedClass.schoolYearLabel)
      .gte("attendance_date", termCtx.termStart)
      .lte("attendance_date", termCtx.termEnd);
    termRecords = (data ?? []) as typeof records;
  }

  const currentMonthRecords = records.filter(
    (r) => r.attendance_date >= monthStart && r.attendance_date <= monthEnd,
  );
  const previousMonthRecords = records.filter(
    (r) => r.attendance_date >= prevMonthStart && r.attendance_date <= prevMonthEnd,
  );

  const allMonthRows = currentMonthRecords.map((r) => ({
    attendanceDate: r.attendance_date,
    status: r.status,
  }));
  const monthTally = statusCountsInRange(allMonthRows, monthStart, monthEnd);
  const prevMonthRowsAll = previousMonthRecords.map((r) => ({
    attendanceDate: r.attendance_date,
    status: r.status,
  }));
  const prevMonthTally = statusCountsInRange(prevMonthRowsAll, prevMonthStart, prevMonthEnd);
  const summaryTrend = compareAttendanceTrend(
    attendancePercent(monthTally),
    attendancePercent(prevMonthTally),
  );

  const students: MonthlyStudentSummary[] = rosterBase.map((r) => {
    const monthRows = currentMonthRecords
      .filter((row) => row.student_id === r.studentId)
      .map((row) => ({ attendanceDate: row.attendance_date, status: row.status }));
    const studentMonth = statusCountsInRange(monthRows, monthStart, monthEnd);
    const prevMonthRows = previousMonthRecords
      .filter((row) => row.student_id === r.studentId)
      .map((row) => ({ attendanceDate: row.attendance_date, status: row.status }));
    const studentPrevMonth = statusCountsInRange(
      prevMonthRows,
      prevMonthStart,
      prevMonthEnd,
    );
    const termRows = termRecords
      .filter((row) => row.student_id === r.studentId)
      .map((row) => ({ attendanceDate: row.attendance_date, status: row.status }));
    const concern = termCtx.ok
      ? evaluateAttendanceConcernFromRecords(
          termRows,
          termCtx.termStart,
          termCtx.termEnd,
          monthEnd,
        )
      : null;
    const highlight =
      studentMonth.absent >= 2 ||
      studentMonth.tardy >= 2 ||
      concern != null;

    return {
      studentId: r.studentId,
      displayName: r.displayName,
      gradeName: r.gradeName,
      daysMarked: studentMonth.marked,
      absences: studentMonth.absent,
      tardies: studentMonth.tardy,
      excused: studentMonth.excused,
      attendancePct: attendancePercent(studentMonth),
      trend: compareAttendanceTrend(
        attendancePercent(studentMonth),
        attendancePercent(studentPrevMonth),
      ),
      highlight,
      concernFollowUp: concern?.followUp ?? null,
    };
  });

  return {
    ok: true,
    classes,
    classId,
    monthStart,
    monthEnd,
    monthLabel,
    summary: {
      daysMarked: monthTally.marked,
      absences: monthTally.absent,
      tardies: monthTally.tardy,
      excused: monthTally.excused,
      attendancePct: attendancePercent(monthTally),
      trend: summaryTrend,
    },
    students,
  };
});
