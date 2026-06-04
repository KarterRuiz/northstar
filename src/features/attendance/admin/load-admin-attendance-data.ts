import "server-only";

import { cache } from "react";

import { loadSchoolYearTermContext } from "@/features/attendance-behavior/load-support-flag-data";
import {
  evaluateAttendanceConcernFromRecords,
  tallyAttendanceConcernMetrics,
} from "@/features/attendance/attendance-concerns";
import {
  getAttendanceRiskTier,
  getSuggestedAttendanceAction,
  type AttendanceRiskTier,
} from "@/features/attendance/attendance-risk-tier";
import {
  previousWeekRange,
  todayIso,
  weekRangeContaining,
} from "@/features/attendance/attendance-date-utils";
import {
  attendancePercent,
  tallyFromRecords,
} from "@/features/attendance/attendance-metrics";
import { compareAttendanceTrend, type AttendanceTrendResult } from "@/features/attendance/attendance-trend";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  schoolYearLabelsForFilteredClasses,
  unwrapOne,
} from "./admin-attendance-school-years";

export type AdminAttendanceSearchParams = {
  date: string | null;
  schoolYear: string | null;
  gradeId: string | null;
  classId: string | null;
  status: string | null;
  section?: string | null;
  heatmapRows?: string | null;
};

export type AdminClassAttendanceRow = {
  classId: string;
  classLabel: string;
  teacherLabel: string;
  gradeId: string;
  gradeName: string;
  markedCount: number;
  totalStudents: number;
  completionPct: number;
  absences: number;
  tardies: number;
  submitted: boolean;
  attendanceTrend: AttendanceTrendResult;
};

export type AdminFollowUpRow = {
  studentId: string;
  studentName: string;
  classId: string;
  classLabel: string;
  termAbsences: number;
  termTardies: number;
  lastAbsentDate: string | null;
  tier: AttendanceRiskTier;
  suggestedAction: string | null;
  hasActiveIntervention: boolean;
};

export type AdminAttendancePageData =
  | {
      ok: true;
      date: string;
      schoolYearLabel: string;
      filterOptions: {
        schoolYears: { label: string }[];
        grades: { id: string; name: string }[];
        classes: { id: string; label: string; gradeId: string }[];
      };
      summary: {
        completionPct: number;
        absencesToday: number;
        tardiesToday: number;
        repeatedAbsenceStudents: number;
        classesNotSubmitted: number;
        attendanceTrend: AttendanceTrendResult;
      };
      classRows: AdminClassAttendanceRow[];
      followUpRows: AdminFollowUpRow[];
    }
  | { ok: false; message: string };

type ClassRow = {
  id: string;
  name: string;
  section: string | null;
  is_active: boolean;
  grade_level_id: string;
  grade_levels: { id: string; name: string } | { id: string; name: string }[] | null;
  school_years: { label: string } | { label: string }[] | null;
};

type ClassTeacherRow = {
  class_id: string;
  teacher_profile_id: string;
  role: string;
};

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

function classLabel(row: ClassRow): string {
  const sec = row.section?.trim();
  const base = row.name.trim() || "Class";
  return sec ? `${base} · ${sec}` : base;
}

export const loadAdminAttendanceData = cache(async function loadAdminAttendanceData(
  params: AdminAttendanceSearchParams,
): Promise<AdminAttendancePageData> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const supabase = await createServerSupabaseClient();
  const date = params.date ?? todayIso();
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
  const grades = [...gradesMap.entries()]
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

  const { start: weekStart, end: weekEnd } = weekRangeContaining(date);
  const { start: prevWeekStart, end: prevWeekEnd } = previousWeekRange(weekStart);

  let todayRecords: {
    class_id: string;
    student_id: string;
    status: string;
    attendance_date: string;
  }[] = [];
  let termRecords: typeof todayRecords = [];
  let weekRecords: typeof todayRecords = [];
  let interventionStudentIds = new Set<string>();

  if (classIds.length > 0 && schoolYearLabels.length > 0) {
    const [todayRes, termRes, weekRes, ivRes] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("class_id, student_id, status, attendance_date")
        .in("school_year", schoolYearLabels)
        .eq("attendance_date", date)
        .in("class_id", classIds),
      termCtx.ok
        ? supabase
            .from("attendance_records")
            .select("class_id, student_id, status, attendance_date")
            .in("school_year", schoolYearLabels)
            .in("class_id", classIds)
            .gte("attendance_date", termCtx.termStart)
            .lte("attendance_date", termCtx.termEnd)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("attendance_records")
        .select("class_id, student_id, status, attendance_date")
        .in("school_year", schoolYearLabels)
        .in("class_id", classIds)
        .gte("attendance_date", prevWeekStart)
        .lte("attendance_date", weekEnd),
      supabase
        .from("student_interventions")
        .select("student_id")
        .eq("intervention_type", "attendance")
        .in("status", ["active", "monitoring", "escalated"]),
    ]);
    if (todayRes.error) return { ok: false, message: todayRes.error.message };
    if (termRes.error) return { ok: false, message: termRes.error.message };
    if (weekRes.error) return { ok: false, message: weekRes.error.message };
    todayRecords = (todayRes.data ?? []) as typeof todayRecords;
    termRecords = (termRes.data ?? []) as typeof termRecords;
    weekRecords = (weekRes.data ?? []) as typeof weekRecords;
    interventionStudentIds = new Set((ivRes.data ?? []).map((r) => r.student_id));
  }

  const currentWeekRecords = weekRecords.filter(
    (r) => r.attendance_date >= weekStart && r.attendance_date <= weekEnd,
  );
  const previousWeekRecords = weekRecords.filter(
    (r) => r.attendance_date >= prevWeekStart && r.attendance_date <= prevWeekEnd,
  );

  const classRows: AdminClassAttendanceRow[] = filteredClasses.map((c) => {
    const totalStudents = enrollmentByClass.get(c.id)?.size ?? 0;
    const todayForClass = todayRecords.filter((r) => r.class_id === c.id);
    const markedStudentIds = new Set(todayForClass.map((r) => r.student_id));
    const markedCount = markedStudentIds.size;
    const absences = todayForClass.filter((r) => r.status === "absent").length;
    const tardies = todayForClass.filter((r) => r.status === "tardy").length;
    const weekForClass = currentWeekRecords.filter((r) => r.class_id === c.id);
    const prevWeekForClass = previousWeekRecords.filter((r) => r.class_id === c.id);
    const attendanceTrend = compareAttendanceTrend(
      attendancePercent(tallyFromRecords(weekForClass.map((r) => ({ status: r.status })))),
      attendancePercent(
        tallyFromRecords(prevWeekForClass.map((r) => ({ status: r.status }))),
      ),
    );
    const gl = unwrapOne(c.grade_levels);
    return {
      classId: c.id,
      classLabel: classLabel(c),
      teacherLabel: teacherLabelForClass(c.id, teachersByClass, profileNames),
      gradeId: c.grade_level_id,
      gradeName: gl?.name ?? "—",
      markedCount,
      totalStudents,
      completionPct:
        totalStudents > 0 ? Math.round((markedCount / totalStudents) * 100) : 0,
      absences,
      tardies,
      submitted: totalStudents > 0 && markedCount >= totalStudents,
      attendanceTrend,
    };
  });

  if (params.status === "submitted") {
    classRows.filter((r) => r.submitted);
  }

  let displayClassRows = classRows;
  if (params.status === "missing") {
    displayClassRows = classRows.filter((r) => !r.submitted && r.totalStudents > 0);
  } else if (params.status === "submitted") {
    displayClassRows = classRows.filter((r) => r.submitted);
  }

  const studentKeys = new Map<string, { classId: string; studentId: string }>();
  for (const en of enrollmentsRes.data ?? []) {
    if (!classIds.includes(en.class_id)) continue;
    studentKeys.set(`${en.student_id}:${en.class_id}`, {
      studentId: en.student_id,
      classId: en.class_id,
    });
  }

  const studentIds = [...new Set([...studentKeys.values()].map((k) => k.studentId))];
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

  const followUpRows: AdminFollowUpRow[] = [];
  for (const { studentId, classId } of studentKeys.values()) {
    const studentRows = termRecords
      .filter((r) => r.student_id === studentId && r.class_id === classId)
      .map((r) => ({ attendanceDate: r.attendance_date, status: r.status }));
    if (!termCtx.ok) continue;
    const metrics = tallyAttendanceConcernMetrics(
      studentRows,
      termCtx.termStart,
      termCtx.termEnd,
    );
    const concern = evaluateAttendanceConcernFromRecords(
      studentRows,
      termCtx.termStart,
      termCtx.termEnd,
    );
    if (!concern) continue;

    const tier = getAttendanceRiskTier(metrics);

    const lastAbsent = studentRows
      .filter((r) => r.status === "absent")
      .map((r) => r.attendanceDate)
      .sort()
      .at(-1) ?? null;

    const klass = filteredClasses.find((c) => c.id === classId);
    followUpRows.push({
      studentId,
      studentName: studentNames.get(studentId) ?? "—",
      classId,
      classLabel: klass ? classLabel(klass) : "—",
      termAbsences: metrics.termAbsences,
      termTardies: metrics.termTardies,
      lastAbsentDate: lastAbsent,
      tier,
      suggestedAction: getSuggestedAttendanceAction(tier),
      hasActiveIntervention: interventionStudentIds.has(studentId),
    });
  }

  followUpRows.sort((a, b) => b.termAbsences - a.termAbsences);

  const totalSlots = classRows.reduce((n, r) => n + r.totalStudents, 0);
  const totalMarked = classRows.reduce((n, r) => n + r.markedCount, 0);
  const absencesToday = classRows.reduce((n, r) => n + r.absences, 0);
  const tardiesToday = classRows.reduce((n, r) => n + r.tardies, 0);
  const schoolWeekTally = tallyFromRecords(
    currentWeekRecords.map((r) => ({ status: r.status })),
  );
  const schoolPrevWeekTally = tallyFromRecords(
    previousWeekRecords.map((r) => ({ status: r.status })),
  );
  const schoolAttendanceTrend = compareAttendanceTrend(
    attendancePercent(schoolWeekTally),
    attendancePercent(schoolPrevWeekTally),
  );

  return {
    ok: true,
    date,
    schoolYearLabel,
    filterOptions: {
      schoolYears,
      grades,
      classes: filteredClasses.map((c) => ({
        id: c.id,
        label: classLabel(c),
        gradeId: c.grade_level_id,
      })),
    },
    summary: {
      completionPct: totalSlots > 0 ? Math.round((totalMarked / totalSlots) * 100) : 0,
      absencesToday,
      tardiesToday,
      repeatedAbsenceStudents: followUpRows.filter((r) => r.termAbsences >= 3).length,
      classesNotSubmitted: classRows.filter((r) => !r.submitted && r.totalStudents > 0).length,
      attendanceTrend: schoolAttendanceTrend,
    },
    classRows: displayClassRows,
    followUpRows,
  };
});
