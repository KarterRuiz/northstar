import "server-only";

import { cache } from "react";

import { loadSchoolYearTermContext } from "@/features/attendance-behavior/load-support-flag-data";
import { tallyAttendanceConcernMetrics } from "@/features/attendance/attendance-concerns";
import {
  monthRangeContaining,
  previousMonthRange,
  previousWeekRange,
  schoolWeeksInMonth,
  todayIso,
  weekdayShort,
  weekRangeContaining,
  weekdaysInWeek,
} from "@/features/attendance/attendance-date-utils";
import {
  attendancePercent,
  statusCountsInRange,
  tallyFromRecords,
} from "@/features/attendance/attendance-metrics";
import {
  getAttendanceRiskTier,
  isElevatedAttendanceRisk,
} from "@/features/attendance/attendance-risk-tier";
import { compareAttendanceTrend, type AttendanceTrendResult } from "@/features/attendance/attendance-trend";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  schoolYearLabelsForFilteredClasses,
  unwrapOne,
} from "./admin-attendance-school-years";
import type { AdminAttendanceSearchParams } from "./load-admin-attendance-data";

export type AdminAttendanceAnalyticsParams = AdminAttendanceSearchParams & {
  heatmapRows?: string | null;
};

/** Show term % with a caveat when fewer than this many distinct marked school days. */
const MIN_MARKED_DAYS_FOR_FULL_TERM_CONFIDENCE = 5;

export type AdminGradeSummaryRow = {
  gradeId: string;
  gradeName: string;
  attendancePct: number | null;
  partialNote: string | null;
  absences: number;
  tardies: number;
  studentsAtRisk: number;
  trend: AttendanceTrendResult;
};

export type AdminClassComparisonRow = {
  classId: string;
  classLabel: string;
  teacherLabel: string;
  attendancePct: number | null;
  partialNote: string | null;
  absences: number;
  tardies: number;
  notSubmittedToday: boolean;
  trend: AttendanceTrendResult;
};

export type AdminHeatmapCell = {
  key: string;
  label: string;
  pct: number | null;
};

export type AdminHeatmapRow = {
  id: string;
  label: string;
  cells: AdminHeatmapCell[];
};

export type AdminHeatmapSection = {
  rowMode: "class" | "grade";
  columns: { key: string; label: string }[];
  rows: AdminHeatmapRow[];
};

export type AdminAttendanceAnalyticsData =
  | {
      ok: true;
      gradeSummaries: AdminGradeSummaryRow[];
      classComparisons: AdminClassComparisonRow[];
      weeklyHeatmap: AdminHeatmapSection;
      monthlyHeatmap: AdminHeatmapSection;
    }
  | { ok: false; message: string };

type ClassRow = {
  id: string;
  name: string;
  section: string | null;
  grade_level_id: string;
  grade_levels: { id: string; name: string } | { id: string; name: string }[] | null;
  school_years: { label: string } | { label: string }[] | null;
};

type ClassTeacherRow = {
  class_id: string;
  teacher_profile_id: string;
  role: string;
};

type AttendanceRecord = {
  class_id: string;
  student_id: string;
  status: string;
  attendance_date: string;
};

function classLabel(row: ClassRow): string {
  const sec = row.section?.trim();
  const base = row.name.trim() || "Class";
  return sec ? `${base} · ${sec}` : base;
}

function teacherLabelForClass(
  classId: string,
  teachersByClass: Map<string, ClassTeacherRow[]>,
  profileNames: Map<string, string>,
): string {
  const list = teachersByClass.get(classId) ?? [];
  const homeroom = list.find((t) => t.role === "homeroom");
  const pick = homeroom ?? list[0];
  if (!pick) return "—";
  return profileNames.get(pick.teacher_profile_id) ?? "—";
}

import { formatHeatmapCellLabel as pctLabel } from "./admin-attendance-heatmap-utils";

function recordsForClass(records: AttendanceRecord[], classId: string): AttendanceRecord[] {
  return records.filter((r) => r.class_id === classId);
}

function recordsForGrade(
  records: AttendanceRecord[],
  classIds: string[],
): AttendanceRecord[] {
  const set = new Set(classIds);
  return records.filter((r) => set.has(r.class_id));
}

function pctForRecords(records: AttendanceRecord[]): number | null {
  return attendancePercent(tallyFromRecords(records.map((r) => ({ status: r.status }))));
}

function distinctMarkedDays(
  records: { attendance_date: string }[],
  start?: string,
  end?: string,
): number {
  const days = new Set<string>();
  for (const row of records) {
    if (start && row.attendance_date < start) continue;
    if (end && row.attendance_date > end) continue;
    days.add(row.attendance_date);
  }
  return days.size;
}

function partialTermNote(markedDays: number): string | null {
  if (markedDays === 0) return null;
  if (markedDays >= MIN_MARKED_DAYS_FOR_FULL_TERM_CONFIDENCE) return null;
  return `Based on ${markedDays} marked school day${markedDays === 1 ? "" : "s"} in range`;
}

function buildWeeklyHeatmap(args: {
  rowMode: "class" | "grade";
  weekdays: string[];
  filteredClasses: ClassRow[];
  weekRecords: AttendanceRecord[];
  grades: { id: string; name: string }[];
}): AdminHeatmapSection {
  const columns = args.weekdays.map((day) => ({
    key: day,
    label: weekdayShort(day),
  }));

  const rows: AdminHeatmapRow[] = [];

  if (args.rowMode === "grade") {
    for (const grade of args.grades) {
      const gradeClassIds = args.filteredClasses
        .filter((c) => c.grade_level_id === grade.id)
        .map((c) => c.id);
      const cells = args.weekdays.map((day) => {
        const dayRecords = recordsForGrade(
          args.weekRecords.filter((r) => r.attendance_date === day),
          gradeClassIds,
        );
        const pct = pctForRecords(dayRecords);
        return { key: day, label: pctLabel(pct), pct };
      });
      rows.push({ id: grade.id, label: grade.name, cells });
    }
  } else {
    for (const c of args.filteredClasses) {
      const cells = args.weekdays.map((day) => {
        const dayRecords = recordsForClass(
          args.weekRecords.filter((r) => r.attendance_date === day),
          c.id,
        );
        const pct = pctForRecords(dayRecords);
        return { key: day, label: pctLabel(pct), pct };
      });
      rows.push({ id: c.id, label: classLabel(c), cells });
    }
  }

  return { rowMode: args.rowMode, columns, rows };
}

function buildMonthlyHeatmap(args: {
  rowMode: "class" | "grade";
  weeks: { start: string; end: string; label: string }[];
  filteredClasses: ClassRow[];
  monthRecords: AttendanceRecord[];
  grades: { id: string; name: string }[];
}): AdminHeatmapSection {
  const columns = args.weeks.map((w) => ({
    key: w.start,
    label: w.label,
  }));

  const rows: AdminHeatmapRow[] = [];

  if (args.rowMode === "grade") {
    for (const grade of args.grades) {
      const gradeClassIds = args.filteredClasses
        .filter((c) => c.grade_level_id === grade.id)
        .map((c) => c.id);
      const cells = args.weeks.map((w) => {
        const weekRecords = recordsForGrade(
          args.monthRecords.filter(
            (r) => r.attendance_date >= w.start && r.attendance_date <= w.end,
          ),
          gradeClassIds,
        );
        const pct = pctForRecords(weekRecords);
        return { key: w.start, label: pctLabel(pct), pct };
      });
      rows.push({ id: grade.id, label: grade.name, cells });
    }
  } else {
    for (const c of args.filteredClasses) {
      const cells = args.weeks.map((w) => {
        const weekRecords = recordsForClass(
          args.monthRecords.filter(
            (r) => r.attendance_date >= w.start && r.attendance_date <= w.end,
          ),
          c.id,
        );
        const pct = pctForRecords(weekRecords);
        return { key: w.start, label: pctLabel(pct), pct };
      });
      rows.push({ id: c.id, label: classLabel(c), cells });
    }
  }

  return { rowMode: args.rowMode, columns, rows };
}

export const loadAdminAttendanceAnalytics = cache(async function loadAdminAttendanceAnalytics(
  params: AdminAttendanceAnalyticsParams,
): Promise<AdminAttendanceAnalyticsData> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const rowMode: "class" | "grade" = params.heatmapRows === "grade" ? "grade" : "class";
  const supabase = await createServerSupabaseClient();
  const date = params.date ?? todayIso();
  const termCtx = await loadSchoolYearTermContext();
  const { start: weekStart, end: weekEnd } = weekRangeContaining(date);
  const { start: prevWeekStart, end: prevWeekEnd } = previousWeekRange(weekStart);
  const { start: monthStart, end: monthEnd } = monthRangeContaining(date);
  const { start: prevMonthStart, end: prevMonthEnd } = previousMonthRange(monthStart);
  const weekdays = weekdaysInWeek(weekStart);
  const monthWeeks = schoolWeeksInMonth(date);

  const [schoolYearsRes, classesRes, enrollmentsRes] = await Promise.all([
    supabase.from("school_years").select("label").order("starts_on", { ascending: false }),
    supabase
      .from("classes")
      .select(
        "id, name, section, is_active, grade_level_id, grade_levels(id, name), school_years(label)",
      )
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("student_enrollments")
      .select("student_id, class_id")
      .eq("status", "active"),
  ]);

  const batchError =
    schoolYearsRes.error?.message ??
    classesRes.error?.message ??
    enrollmentsRes.error?.message;
  if (batchError) return { ok: false, message: batchError };

  const schoolYears = (schoolYearsRes.data ?? []).map((sy) => ({
    label: sy.label.trim(),
  }));
  const schoolYearLabel =
    params.schoolYear && schoolYears.some((sy) => sy.label === params.schoolYear)
      ? params.schoolYear
      : schoolYears[0]?.label ?? (termCtx.ok ? termCtx.schoolYearLabel : "");

  const classes = (classesRes.data ?? []) as ClassRow[];
  const enrollmentByClass = new Map<string, Set<string>>();
  const studentsByGrade = new Map<string, Set<string>>();

  for (const en of enrollmentsRes.data ?? []) {
    const set = enrollmentByClass.get(en.class_id) ?? new Set();
    set.add(en.student_id);
    enrollmentByClass.set(en.class_id, set);
  }

  const gradesMap = new Map<string, string>();
  for (const c of classes) {
    const gl = unwrapOne(c.grade_levels);
    if (gl) gradesMap.set(gl.id, gl.name);
  }
  const allGrades = [...gradesMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let filteredClasses = classes.filter((c) => {
    const sy = unwrapOne(c.school_years);
    return sy?.label === schoolYearLabel;
  });
  if (params.gradeId) {
    filteredClasses = filteredClasses.filter((c) => c.grade_level_id === params.gradeId);
  }
  if (params.classId) {
    filteredClasses = filteredClasses.filter((c) => c.id === params.classId);
  }

  for (const c of filteredClasses) {
    const enrolled = enrollmentByClass.get(c.id);
    if (!enrolled) continue;
    const gradeSet = studentsByGrade.get(c.grade_level_id) ?? new Set();
    for (const sid of enrolled) gradeSet.add(sid);
    studentsByGrade.set(c.grade_level_id, gradeSet);
  }

  const visibleGrades = params.gradeId
    ? allGrades.filter((g) => g.id === params.gradeId)
    : allGrades.filter((g) =>
        filteredClasses.some((c) => c.grade_level_id === g.id),
      );

  const classIds = filteredClasses.map((c) => c.id);
  const schoolYearLabels = schoolYearLabelsForFilteredClasses(
    filteredClasses,
    schoolYearLabel,
    termCtx.ok ? termCtx.schoolYearLabel : "",
  );

  const teachersByClass = new Map<string, ClassTeacherRow[]>();
  const profileNames = new Map<string, string>();
  if (classIds.length > 0) {
    const { data: classTeachers } = await supabase
      .from("class_teachers")
      .select("class_id, teacher_profile_id, role")
      .in("class_id", classIds);
    for (const row of (classTeachers ?? []) as ClassTeacherRow[]) {
      const list = teachersByClass.get(row.class_id) ?? [];
      list.push(row);
      teachersByClass.set(row.class_id, list);
    }
    const teacherIds = [
      ...new Set((classTeachers ?? []).map((t) => t.teacher_profile_id)),
    ];
    if (teacherIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", teacherIds);
      for (const p of profiles ?? []) {
        profileNames.set(
          p.id,
          p.full_name?.trim() || p.email?.trim() || "—",
        );
      }
    }
  }

  let termRecords: AttendanceRecord[] = [];
  let weekRecords: AttendanceRecord[] = [];
  let monthRecords: AttendanceRecord[] = [];
  let todayRecords: AttendanceRecord[] = [];

  if (classIds.length > 0 && schoolYearLabels.length > 0) {
    let termQuery = supabase
      .from("attendance_records")
      .select("class_id, student_id, status, attendance_date")
      .in("school_year", schoolYearLabels)
      .in("class_id", classIds);
    if (termCtx.ok) {
      termQuery = termQuery
        .gte("attendance_date", termCtx.termStart)
        .lte("attendance_date", termCtx.termEnd);
    }

    const [termRes, weekRes, monthRes, todayRes] = await Promise.all([
      termQuery,
      supabase
        .from("attendance_records")
        .select("class_id, student_id, status, attendance_date")
        .in("school_year", schoolYearLabels)
        .in("class_id", classIds)
        .gte("attendance_date", prevWeekStart)
        .lte("attendance_date", weekEnd),
      supabase
        .from("attendance_records")
        .select("class_id, student_id, status, attendance_date")
        .in("school_year", schoolYearLabels)
        .in("class_id", classIds)
        .gte("attendance_date", prevMonthStart)
        .lte("attendance_date", monthEnd),
      supabase
        .from("attendance_records")
        .select("class_id, student_id, status, attendance_date")
        .in("school_year", schoolYearLabels)
        .eq("attendance_date", date)
        .in("class_id", classIds),
    ]);

    const err =
      termRes.error?.message ??
      weekRes.error?.message ??
      monthRes.error?.message ??
      todayRes.error?.message;
    if (err) return { ok: false, message: err };

    termRecords = (termRes.data ?? []) as AttendanceRecord[];
    weekRecords = (weekRes.data ?? []) as AttendanceRecord[];
    monthRecords = (monthRes.data ?? []) as AttendanceRecord[];
    todayRecords = (todayRes.data ?? []) as AttendanceRecord[];
  }

  const studentKeys = new Map<string, { studentId: string; classId: string; gradeId: string }>();
  for (const en of enrollmentsRes.data ?? []) {
    if (!classIds.includes(en.class_id)) continue;
    const klass = filteredClasses.find((c) => c.id === en.class_id);
    if (!klass) continue;
    studentKeys.set(`${en.student_id}:${en.class_id}`, {
      studentId: en.student_id,
      classId: en.class_id,
      gradeId: klass.grade_level_id,
    });
  }

  const atRiskByGrade = new Map<string, number>();
  for (const grade of visibleGrades) {
    atRiskByGrade.set(grade.id, 0);
  }

  for (const { studentId, classId, gradeId } of studentKeys.values()) {
    const studentRows = termRecords
      .filter((r) => r.student_id === studentId && r.class_id === classId)
      .map((r) => ({ attendanceDate: r.attendance_date, status: r.status }));
    if (!termCtx.ok) continue;
    const metrics = tallyAttendanceConcernMetrics(
      studentRows,
      termCtx.termStart,
      termCtx.termEnd,
      date,
    );
    const tier = getAttendanceRiskTier(metrics);
    if (isElevatedAttendanceRisk(tier)) {
      atRiskByGrade.set(gradeId, (atRiskByGrade.get(gradeId) ?? 0) + 1);
    }
  }

  const currentMonthSlice = monthRecords.filter(
    (r) => r.attendance_date >= monthStart && r.attendance_date <= monthEnd,
  );
  const prevMonthSlice = monthRecords.filter(
    (r) => r.attendance_date >= prevMonthStart && r.attendance_date <= prevMonthEnd,
  );

  const gradeSummaries: AdminGradeSummaryRow[] = visibleGrades.map((grade) => {
    const gradeClassIds = filteredClasses
      .filter((c) => c.grade_level_id === grade.id)
      .map((c) => c.id);

    const termRows = recordsForGrade(termRecords, gradeClassIds).map((r) => ({
      attendanceDate: r.attendance_date,
      status: r.status,
    }));
    const termTally = termCtx.ok
      ? statusCountsInRange(termRows, termCtx.termStart, termCtx.termEnd)
      : tallyFromRecords(termRows.map((r) => ({ status: r.status })));
    const gradeTermRecords = recordsForGrade(termRecords, gradeClassIds);
    const markedDays = termCtx.ok
      ? distinctMarkedDays(gradeTermRecords, termCtx.termStart, termCtx.termEnd)
      : distinctMarkedDays(gradeTermRecords);

    const monthRows = recordsForGrade(currentMonthSlice, gradeClassIds);
    const prevMonthRows = recordsForGrade(prevMonthSlice, gradeClassIds);

    return {
      gradeId: grade.id,
      gradeName: grade.name,
      attendancePct: attendancePercent(termTally),
      partialNote: partialTermNote(markedDays),
      absences: termTally.absent,
      tardies: termTally.tardy,
      studentsAtRisk: atRiskByGrade.get(grade.id) ?? 0,
      trend: compareAttendanceTrend(
        pctForRecords(monthRows),
        pctForRecords(prevMonthRows),
      ),
    };
  });

  const currentWeekSlice = weekRecords.filter(
    (r) => r.attendance_date >= weekStart && r.attendance_date <= weekEnd,
  );
  const prevWeekSlice = weekRecords.filter(
    (r) => r.attendance_date >= prevWeekStart && r.attendance_date <= prevWeekEnd,
  );

  const classComparisons: AdminClassComparisonRow[] = filteredClasses.map((c) => {
    const termRows = recordsForClass(termRecords, c.id).map((r) => ({
      attendanceDate: r.attendance_date,
      status: r.status,
    }));
    const termTally = termCtx.ok
      ? statusCountsInRange(termRows, termCtx.termStart, termCtx.termEnd)
      : tallyFromRecords(termRows.map((r) => ({ status: r.status })));
    const classTermRecords = recordsForClass(termRecords, c.id);
    const markedDays = termCtx.ok
      ? distinctMarkedDays(classTermRecords, termCtx.termStart, termCtx.termEnd)
      : distinctMarkedDays(classTermRecords);

    const weekRows = recordsForClass(currentWeekSlice, c.id);
    const prevWeekRows = recordsForClass(prevWeekSlice, c.id);

    const todayForClass = recordsForClass(todayRecords, c.id);
    const totalStudents = enrollmentByClass.get(c.id)?.size ?? 0;
    const markedToday = new Set(todayForClass.map((r) => r.student_id)).size;

    return {
      classId: c.id,
      classLabel: classLabel(c),
      teacherLabel: teacherLabelForClass(c.id, teachersByClass, profileNames),
      attendancePct: attendancePercent(termTally),
      partialNote: partialTermNote(markedDays),
      absences: termTally.absent,
      tardies: termTally.tardy,
      notSubmittedToday: totalStudents > 0 && markedToday < totalStudents,
      trend: compareAttendanceTrend(pctForRecords(weekRows), pctForRecords(prevWeekRows)),
    };
  });

  classComparisons.sort((a, b) => a.classLabel.localeCompare(b.classLabel));

  const weeklyHeatmap = buildWeeklyHeatmap({
    rowMode,
    weekdays,
    filteredClasses,
    weekRecords: currentWeekSlice,
    grades: visibleGrades,
  });

  const monthlyHeatmap = buildMonthlyHeatmap({
    rowMode,
    weeks: monthWeeks,
    filteredClasses,
    monthRecords: currentMonthSlice,
    grades: visibleGrades,
  });

  return {
    ok: true,
    gradeSummaries,
    classComparisons,
    weeklyHeatmap,
    monthlyHeatmap,
  };
});
