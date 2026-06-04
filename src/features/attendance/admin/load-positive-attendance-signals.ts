import "server-only";

import { cache } from "react";

import { loadSchoolYearTermContext } from "@/features/attendance-behavior/load-support-flag-data";
import {
  monthRangeContaining,
  todayIso,
  weekRangeContaining,
} from "@/features/attendance/attendance-date-utils";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { schoolYearLabelsForFilteredClasses, unwrapOne } from "./admin-attendance-school-years";
import type { AdminAttendanceSearchParams } from "./load-admin-attendance-data";
import {
  buildPositiveAttendanceSignals,
  buildPositiveSignalsEmptyHints,
  priorMonthRange,
  priorWeekRange,
  type PositiveAttendanceSignals,
} from "./positive-attendance-signals";

export type { PositiveAttendanceSignals };

function classLabel(name: string, section: string | null): string {
  const sec = section?.trim();
  const base = name.trim() || "Class";
  return sec ? `${base} · ${sec}` : base;
}

const emptySignals = (anchorDate: string): PositiveAttendanceSignals => {
  const signals = buildPositiveAttendanceSignals({
    anchorDate,
    classes: [],
    records: [],
    studentNames: new Map(),
    enrollmentKeys: [],
  });
  return {
    ...signals,
    emptyHints: buildPositiveSignalsEmptyHints({
      classCount: 0,
      maxWeeklySchoolDays: 0,
      maxPriorWeeklySchoolDays: 0,
      maxMonthlySchoolDays: 0,
      gradeCount: 0,
    }),
  };
};

export const loadPositiveAttendanceSignals = cache(async function loadPositiveAttendanceSignals(
  params: AdminAttendanceSearchParams,
): Promise<PositiveAttendanceSignals> {
  const anchorDate = params.date ?? todayIso();
  if (!isSupabaseConfigured()) {
    return emptySignals(anchorDate);
  }

  const supabase = await createServerSupabaseClient();
  const termCtx = await loadSchoolYearTermContext();

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

  if (schoolYearsRes.error || classesRes.error || enrollmentsRes.error) {
    return emptySignals(anchorDate);
  }

  const schoolYears = (schoolYearsRes.data ?? []).map((sy) => ({
    label: sy.label.trim(),
  }));
  const schoolYearLabel =
    params.schoolYear && schoolYears.some((sy) => sy.label === params.schoolYear)
      ? params.schoolYear
      : schoolYears[0]?.label ?? (termCtx.ok ? termCtx.schoolYearLabel : "");

  type ClassRow = {
    id: string;
    name: string;
    section: string | null;
    grade_level_id: string;
    grade_levels: { id: string; name: string } | { id: string; name: string }[] | null;
    school_years: { label: string } | { label: string }[] | null;
  };

  let filteredClasses = (classesRes.data ?? []) as ClassRow[];
  filteredClasses = filteredClasses.filter((c) => {
    const sy = unwrapOne(c.school_years);
    return sy?.label === schoolYearLabel;
  });
  if (params.gradeId) {
    filteredClasses = filteredClasses.filter((c) => c.grade_level_id === params.gradeId);
  }
  if (params.classId) {
    filteredClasses = filteredClasses.filter((c) => c.id === params.classId);
  }

  const classIds = filteredClasses.map((c) => c.id);
  if (classIds.length === 0) {
    return emptySignals(anchorDate);
  }

  const schoolYearLabels = schoolYearLabelsForFilteredClasses(
    filteredClasses,
    schoolYearLabel,
    termCtx.ok ? termCtx.schoolYearLabel : "",
  );
  if (schoolYearLabels.length === 0) {
    return emptySignals(anchorDate);
  }

  const { start: weekStart } = weekRangeContaining(anchorDate);
  const priorWeek = priorWeekRange(weekStart);
  const { start: monthStart } = monthRangeContaining(anchorDate);
  const priorMonth = priorMonthRange(monthStart);
  const rangeStart = priorMonth.start < priorWeek.start ? priorMonth.start : priorWeek.start;
  const { end: weekEnd } = weekRangeContaining(anchorDate);
  const { end: monthEnd } = monthRangeContaining(anchorDate);
  const rangeEnd = weekEnd > monthEnd ? weekEnd : monthEnd;
  const cappedEnd = anchorDate < rangeEnd ? anchorDate : rangeEnd;

  const { data: recordsData, error: recordsError } = await supabase
    .from("attendance_records")
    .select("class_id, student_id, status, attendance_date")
    .in("school_year", schoolYearLabels)
    .in("class_id", classIds)
    .gte("attendance_date", rangeStart)
    .lte("attendance_date", cappedEnd);

  if (recordsError) {
    return emptySignals(anchorDate);
  }

  const records = (recordsData ?? []).map((r) => ({
    classId: r.class_id,
    studentId: r.student_id,
    attendanceDate: r.attendance_date,
    status: r.status,
  }));

  const enrollmentKeys: { studentId: string; classId: string }[] = [];
  for (const en of enrollmentsRes.data ?? []) {
    if (!classIds.includes(en.class_id)) continue;
    enrollmentKeys.push({ studentId: en.student_id, classId: en.class_id });
  }

  const studentIds = [...new Set(enrollmentKeys.map((k) => k.studentId))];
  const studentNames = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from("students")
      .select("id, first_name, last_name, preferred_name")
      .in("id", studentIds);
    for (const s of students ?? []) {
      const pref = s.preferred_name?.trim();
      studentNames.set(
        s.id,
        pref || [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "—",
      );
    }
  }

  const classes = filteredClasses.map((c) => {
    const gl = unwrapOne(c.grade_levels);
    return {
      classId: c.id,
      classLabel: classLabel(c.name, c.section),
      gradeId: c.grade_level_id,
      gradeName: gl?.name ?? "—",
    };
  });

  return buildPositiveAttendanceSignals({
    anchorDate,
    classes,
    records,
    studentNames,
    enrollmentKeys,
  });
});
