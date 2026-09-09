import "server-only";

import { cache } from "react";

import type { Role } from "@/config/roles";
import { schoolTodayIso } from "@/features/calendar/school-timezone";
import {
  countCompleteStudents,
  resolveReportingCycle,
  type ReportingFileInput,
} from "@/features/report-cards/reporting-progress";
import { loadCheckInSignals } from "@/features/teacher/dashboard/load-check-in-signals";
import {
  attendanceStatusForClass,
} from "@/features/teacher/dashboard/teacher-home-summaries";
import {
  classRosterHasStudentNumbers,
  classRosterSearchText,
  rosterSupportLabel,
  teacherStudentDisplayName,
} from "@/features/teacher/class-workspace/class-roster";
import { attendancePulseLabel } from "@/features/teacher/class-workspace/class-workspace-copy";
import { compareRosterOrder } from "@/features/students/roster-order";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { academicsPulseLabel } from "./class-data-center-copy";
import { classDataCenterStudentProfileHref } from "./constants";
import { loadClassDataCenterContext } from "./load-class-data-center-context";
import { assessStudentsDeleteSafety } from "@/features/students/assess-student-delete-safety";

type StudentEmbed = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  external_id: string | null;
};

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const IN_CHUNK = 120;
function chunkIds(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(ids.slice(i, i + IN_CHUNK));
  return out;
}

export type ClassDataCenterRosterStudent = {
  studentId: string;
  enrollmentId: string;
  displayName: string;
  studentNumber: string | null;
  searchText: string;
  href: string;
  editHref: string;
  attendanceLabel: string;
  academicsLabel: string;
  supportLabel: string;
  needsSupport: boolean;
  recordsLabel: string;
  recordsRemaining: boolean;
  /** True when hard-delete is safe (no dependent history). Leadership roster only. */
  canHardDelete: boolean;
};

export type ClassDataCenterStudentsData =
  | {
      ok: true;
      role: Role;
      classId: string;
      classTitle: string;
      schoolYearLabel: string | null;
      students: ClassDataCenterRosterStudent[];
      showStudentNumber: boolean;
    }
  | { ok: false; message: string };

export const loadClassDataCenterStudents = cache(
  async (classId: string): Promise<ClassDataCenterStudentsData> => {
    const ctx = await loadClassDataCenterContext(classId);
    if (!ctx.ok) return ctx;
    if (!isSupabaseConfigured()) {
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const supabase = await createServerSupabaseClient();
    const { role, schoolYearLabel, isCurrentYear, studentCount, title: classTitle } =
      ctx.context;
    const todayIso = schoolTodayIso();
    const yearRes = await loadCurrentSchoolYear(supabase);
    if (!yearRes.ok) return { ok: false, message: yearRes.error };
    const yearLabel = yearRes.year?.label || schoolYearLabel || "";

    const { data: enRows, error: enError } = await supabase
      .from("student_enrollments")
      .select(
        `
        id,
        student_id,
        roster_number,
        students!inner (
          id, first_name, last_name, preferred_name, external_id
        )
      `,
      )
      .eq("status", "active")
      .eq("class_id", classId);

    if (enError) {
      logServerError("class-data-center-students.loadEnrollments", enError.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    type Draft = {
      studentId: string;
      enrollmentId: string;
      displayName: string;
      studentNumber: string | null;
      rosterNumber: number | null;
      searchText: string;
    };
    const drafts: Draft[] = [];
    for (const raw of enRows ?? []) {
      const enrollmentId = (raw as { id?: string }).id;
      const rosterNumberRaw = (raw as { roster_number?: number | null }).roster_number;
      const rosterNumber =
        typeof rosterNumberRaw === "number" && Number.isFinite(rosterNumberRaw)
          ? rosterNumberRaw
          : null;
      const student = unwrapOne(
        (raw as { students: StudentEmbed | StudentEmbed[] | null }).students,
      );
      if (!student?.id || !enrollmentId) continue;
      const firstName = student.first_name ?? "";
      const lastName = student.last_name ?? "";
      const preferredName = student.preferred_name?.trim() || null;
      const studentNumber = student.external_id?.trim() || null;
      const displayName = teacherStudentDisplayName({
        preferredName,
        firstName,
        lastName,
      });
      drafts.push({
        studentId: student.id,
        enrollmentId,
        displayName,
        studentNumber,
        rosterNumber,
        searchText: classRosterSearchText({
          displayName,
          firstName,
          lastName,
          preferredName,
          studentNumber,
        }),
      });
    }
    drafts.sort((a, b) =>
      compareRosterOrder(
        { rosterNumber: a.rosterNumber, displayName: a.displayName },
        { rosterNumber: b.rosterNumber, displayName: b.displayName },
      ),
    );

    if (drafts.length === 0) {
      return {
        ok: true,
        role,
        classId,
        classTitle,
        schoolYearLabel: yearRes.year?.label || schoolYearLabel || null,
        students: [],
        showStudentNumber: false,
      };
    }

    const studentIds = drafts.map((d) => d.studentId);

    const [signalsByKey, attendanceRes, assignRes, termsRes, files, deleteSafety] =
      await Promise.all([
        loadCheckInSignals(
          studentIds.map((studentId) => ({ studentId, classId, schoolYearLabel: yearLabel })),
        ),
        supabase
          .from("attendance_records")
          .select("student_id")
          .eq("class_id", classId)
          .eq("attendance_date", todayIso),
        supabase.from("gradebook_assignments").select("id").eq("class_id", classId),
        yearRes.year && isCurrentYear
          ? supabase
              .from("terms")
              .select("code, name, starts_on, ends_on")
              .eq("school_year_id", yearRes.year.id)
              .order("starts_on", { ascending: true })
          : Promise.resolve({
              data: [] as { code: string; name: string; starts_on: string; ends_on: string }[],
              error: null,
            }),
        isCurrentYear
          ? loadReportCardFiles(supabase, studentIds, yearRes.year?.label ?? null)
          : Promise.resolve([] as ReportingFileInput[]),
        assessStudentsDeleteSafety(supabase, studentIds).catch((err: unknown) => {
          logServerError(
            "class-data-center-students.deleteSafety",
            err instanceof Error ? err.message : "unknown",
          );
          return null;
        }),
      ]);

    const markedToday = new Set((attendanceRes.data ?? []).map((r) => r.student_id));
    const classAttendance = attendanceStatusForClass({
      studentCount,
      markedCount: markedToday.size,
    });
    const classAttendanceLabel = attendancePulseLabel(classAttendance);
    const assignmentCount = (assignRes.data ?? []).length;

    const cycle = resolveReportingCycle({
      schoolYearLabel: yearRes.year?.label ?? null,
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

    const completeSet = new Set<string>();
    if (reportingStarted && cycle.term) {
      // countCompleteStudents returns a number; rebuild per-student via files
      for (const sid of studentIds) {
        const n = countCompleteStudents([sid], files, cycle.term.code);
        if (n > 0) completeSet.add(sid);
      }
    }

    const students: ClassDataCenterRosterStudent[] = drafts.map((row) => {
      const reason = signalsByKey.get(`${row.studentId}:${classId}`)?.reason ?? null;
      const marked = markedToday.has(row.studentId);
      const attendanceLabel =
        classAttendance === "not_required"
          ? "—"
          : marked
            ? "Marked"
            : classAttendance === "complete"
              ? "Present window closed"
              : "Not marked";
      const recordsLabel = !reportingStarted
        ? "Not started"
        : completeSet.has(row.studentId)
          ? "Complete"
          : "Remaining";
      return {
        studentId: row.studentId,
        enrollmentId: row.enrollmentId,
        displayName: row.displayName,
        studentNumber: row.studentNumber,
        searchText: row.searchText,
        href: classDataCenterStudentProfileHref(role, row.studentId),
        editHref: `/dashboard/${role}/students/${row.studentId}/edit`,
        attendanceLabel:
          classAttendance === "not_submitted" && !marked
            ? "Not marked"
            : marked
              ? "Marked"
              : classAttendanceLabel === "Complete"
                ? "Marked"
                : attendanceLabel,
        academicsLabel:
          assignmentCount <= 0 ? "—" : academicsPulseLabel({ assignmentCount, scoredCellCount: 1 }),
        supportLabel: rosterSupportLabel(reason),
        needsSupport: reason != null,
        recordsLabel,
        recordsRemaining: reportingStarted && !completeSet.has(row.studentId),
        // Prefer archive when safety could not be assessed.
        canHardDelete: deleteSafety?.get(row.studentId)?.canHardDelete === true,
      };
    });

    // Soften per-row academics: show dash unless class has grades
    for (const s of students) {
      if (assignmentCount <= 0) s.academicsLabel = "—";
      else if (assignmentCount === 1) s.academicsLabel = "In progress";
      else s.academicsLabel = "In progress";
    }

    return {
      ok: true,
      role,
      classId,
      classTitle,
      schoolYearLabel: yearRes.year?.label || schoolYearLabel || null,
      students,
      showStudentNumber: classRosterHasStudentNumbers(students),
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
    if (error) continue;
    for (const row of data ?? []) {
      if (row.status !== "draft" && row.status !== "final" && row.status !== "archive") continue;
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
