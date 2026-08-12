import "server-only";

import { cache } from "react";

import { schoolTodayIso } from "@/features/calendar/school-timezone";
import {
  countCompleteStudents,
  resolveReportingCycle,
  type ReportingFileInput,
} from "@/features/report-cards/reporting-progress";
import { loadCheckInSignals } from "@/features/teacher/dashboard/load-check-in-signals";
import {
  attendanceStatusForClass,
  checkInDetailLabel,
  rankCheckInStudents,
  type TeacherAttendanceStatus,
  type TeacherCheckInReason,
} from "@/features/teacher/dashboard/teacher-home-summaries";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  CLASS_WORKSPACE_CHECK_IN_LIMIT,
  classWorkspaceStudentInterventionsHref,
} from "./constants";
import { loadTeacherClassContext } from "./load-teacher-class-context";
import { attendancePulseLabel, reportCardsPulseLabel } from "./class-workspace-copy";

const IN_CHUNK = 120;

function chunkIds(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(ids.slice(i, IN_CHUNK + i));
  }
  return out;
}

function studentDisplayName(row: {
  preferred_name: string | null;
  first_name: string;
  last_name: string;
}): string {
  const pref = row.preferred_name?.trim();
  if (pref) return pref;
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Student";
}

export type TeacherClassCheckInStudent = {
  studentId: string;
  displayName: string;
  reason: TeacherCheckInReason;
  detail: string;
  href: string;
};

export type TeacherClassOverviewData =
  | {
      ok: true;
      studentCount: number;
      attendance: TeacherAttendanceStatus;
      attendanceLabel: string;
      checkInCount: number;
      checkIn: TeacherClassCheckInStudent[];
      reportCardsLabel: string;
      isCurrentYear: boolean;
    }
  | { ok: false; message: string };

/**
 * Overview pulse for one class. Attendance today, check-in list, and
 * report-card status only — no gradebook tables, full note lists, or other classes.
 */
export const loadTeacherClassOverview = cache(
  async (classId: string): Promise<TeacherClassOverviewData> => {
    const ctx = await loadTeacherClassContext(classId);
    if (!ctx.ok) return ctx;

    if (!isSupabaseConfigured()) {
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const supabase = await createServerSupabaseClient();
    const yearRes = await loadCurrentSchoolYear(supabase);
    if (!yearRes.ok) {
      return { ok: false, message: yearRes.error };
    }

    const currentYear = yearRes.year;
    const todayIso = schoolTodayIso();
    const { studentCount, isCurrentYear, schoolYearLabel } = ctx.context;

    const enrollmentsRes = await supabase
      .from("student_enrollments")
      .select("student_id")
      .eq("class_id", classId)
      .eq("status", "active");

    if (enrollmentsRes.error) {
      logServerError("class-overview.loadEnrollments", enrollmentsRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const studentIds = [
      ...new Set((enrollmentsRes.data ?? []).map((row) => row.student_id).filter(Boolean)),
    ];

    const attendanceRes = await supabase
      .from("attendance_records")
      .select("student_id")
      .eq("class_id", classId)
      .eq("attendance_date", todayIso);

    if (attendanceRes.error) {
      logServerError("class-overview.loadAttendance", attendanceRes.error.message);
    }

    const markedCount = new Set((attendanceRes.data ?? []).map((row) => row.student_id)).size;
    const attendance = attendanceStatusForClass({ studentCount, markedCount });

    if (studentIds.length === 0) {
      return {
        ok: true,
        studentCount,
        attendance,
        attendanceLabel: attendancePulseLabel(attendance),
        checkInCount: 0,
        checkIn: [],
        reportCardsLabel: reportCardsPulseLabel({
          isCurrentYear,
          reportingStarted: false,
          enrolledCount: 0,
          completeCount: null,
        }),
        isCurrentYear,
      };
    }

    const yearLabel = currentYear?.label || schoolYearLabel || "";
    const [signalsByKey, termsRes, files] = await Promise.all([
      loadCheckInSignals(
        studentIds.map((studentId) => ({
          studentId,
          classId,
          schoolYearLabel: yearLabel,
        })),
      ),
      currentYear && isCurrentYear
        ? supabase
            .from("terms")
            .select("code, name, starts_on, ends_on")
            .eq("school_year_id", currentYear.id)
            .order("starts_on", { ascending: true })
        : Promise.resolve({
            data: [] as { code: string; name: string; starts_on: string; ends_on: string }[],
            error: null,
          }),
      isCurrentYear
        ? loadReportCardFiles(supabase, studentIds, currentYear?.label ?? null)
        : Promise.resolve([] as ReportingFileInput[]),
    ]);

    if (termsRes.error) {
      logServerError("class-overview.loadTerms", termsRes.error.message);
    }

    const candidates: {
      studentId: string;
      reason: TeacherCheckInReason;
      missingAssignmentCount: number;
    }[] = [];
    for (const studentId of studentIds) {
      const signal = signalsByKey.get(`${studentId}:${classId}`);
      if (!signal?.reason) continue;
      candidates.push({
        studentId,
        reason: signal.reason,
        missingAssignmentCount: signal.missingAssignmentCount,
      });
    }

    const ranked = rankCheckInStudents(candidates, CLASS_WORKSPACE_CHECK_IN_LIMIT);
    const nameById = await loadStudentNames(
      supabase,
      ranked.map((row) => row.studentId),
    );
    const checkIn: TeacherClassCheckInStudent[] = ranked.map((row) => ({
      studentId: row.studentId,
      displayName: nameById.get(row.studentId) ?? "Student",
      reason: row.reason,
      detail: checkInDetailLabel({
        reason: row.reason,
        missingAssignmentCount: row.missingAssignmentCount,
      }),
      href: classWorkspaceStudentInterventionsHref(row.studentId),
    }));

    const cycle = resolveReportingCycle({
      schoolYearLabel: currentYear?.label ?? null,
      terms: (termsRes.data ?? []).map((term) => ({
        code: term.code,
        name: term.name,
        startsOn: term.starts_on,
        endsOn: term.ends_on,
      })),
      todayIso,
    });
    const reportingStarted =
      isCurrentYear &&
      cycle.termsConfigured &&
      cycle.status !== "not_started" &&
      Boolean(cycle.term);
    const reportCompleteCount =
      reportingStarted && cycle.term
        ? countCompleteStudents(studentIds, files, cycle.term.code)
        : null;

    return {
      ok: true,
      studentCount,
      attendance,
      attendanceLabel: attendancePulseLabel(attendance),
      checkInCount: candidates.length,
      checkIn,
      reportCardsLabel: reportCardsPulseLabel({
        isCurrentYear,
        reportingStarted,
        enrolledCount: studentIds.length,
        completeCount: reportCompleteCount,
      }),
      isCurrentYear,
    };
  },
);

async function loadReportCardFiles(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  studentIds: string[],
  schoolYearLabel: string | null,
): Promise<ReportingFileInput[]> {
  if (studentIds.length === 0 || !schoolYearLabel) return [];

  const files: ReportingFileInput[] = [];
  for (const part of chunkIds(studentIds)) {
    const { data, error } = await supabase
      .from("report_card_files")
      .select("id, student_id, term, status, voided_at, updated_at")
      .in("student_id", part)
      .eq("school_year", schoolYearLabel);

    if (error) {
      logServerError("class-overview.reportCards", error.message);
      continue;
    }
    for (const row of data ?? []) {
      if (row.status !== "draft" && row.status !== "final" && row.status !== "archive") {
        continue;
      }
      files.push({
        id: row.id,
        studentId: row.student_id,
        term: row.term,
        status: row.status,
        voidedAt: row.voided_at,
        updatedAt: row.updated_at,
      });
    }
  }
  return files;
}

async function loadStudentNames(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  studentIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (studentIds.length === 0) return names;

  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, preferred_name")
    .in("id", studentIds);

  if (error) {
    logServerError("class-overview.studentNames", error.message);
    return names;
  }

  for (const row of data ?? []) {
    names.set(row.id, studentDisplayName(row));
  }
  return names;
}
