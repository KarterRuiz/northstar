import "server-only";

import { cache } from "react";

import type { AttendanceStatus } from "@/features/attendance/schema";
import { attendanceStatuses } from "@/features/attendance/schema";
import { addSchoolDays, schoolTodayIso } from "@/features/calendar/school-timezone";
import {
  attendanceStatusForClass,
  type TeacherAttendanceStatus,
} from "@/features/teacher/dashboard/teacher-home-summaries";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  buildClassAttendanceHistory,
  CLASS_ATTENDANCE_HISTORY_LOOKBACK_DAYS,
  parseClassAttendanceDate,
  tallyClassAttendance,
  type ClassAttendanceHistoryRow,
} from "./class-attendance";
import { attendancePulseLabel, studentCountLabel } from "./class-workspace-copy";
import { teacherStudentDisplayName } from "./class-roster";
import { loadTeacherClassContext } from "./load-teacher-class-context";

type StudentEmbed = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
};

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function parseStatus(value: string | null): AttendanceStatus | null {
  if (value && attendanceStatuses.includes(value as AttendanceStatus)) {
    return value as AttendanceStatus;
  }
  return null;
}

export type ClassAttendanceRosterRow = {
  studentId: string;
  displayName: string;
  status: AttendanceStatus | null;
  notes: string | null;
};

export type TeacherClassAttendanceData =
  | {
      ok: true;
      classId: string;
      schoolYearLabel: string;
      attendanceDate: string;
      studentCountLabel: string;
      completion: TeacherAttendanceStatus;
      completionLabel: string;
      roster: ClassAttendanceRosterRow[];
      history: ClassAttendanceHistoryRow[];
    }
  | { ok: false; message: string };

/**
 * Daily attendance for one opened class. Does not load other classes or
 * fall back to a different class when this one is historical.
 */
export const loadTeacherClassAttendance = cache(
  async (
    classId: string,
    attendanceDateRaw: string | null,
  ): Promise<TeacherClassAttendanceData> => {
    const ctx = await loadTeacherClassContext(classId);
    if (!ctx.ok) return ctx;

    if (!isSupabaseConfigured()) {
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const supabase = await createServerSupabaseClient();
    const attendanceDate = parseClassAttendanceDate(attendanceDateRaw, schoolTodayIso());
    const schoolYearLabel = ctx.context.schoolYearLabel.trim();
    const historyStart = addSchoolDays(
      attendanceDate,
      -CLASS_ATTENDANCE_HISTORY_LOOKBACK_DAYS,
    );

    const [enrollmentsRes, recordsRes] = await Promise.all([
      supabase
        .from("student_enrollments")
        .select(
          `
          student_id,
          students!inner (
            id,
            first_name,
            last_name,
            preferred_name
          )
        `,
        )
        .eq("status", "active")
        .eq("class_id", classId),
      supabase
        .from("attendance_records")
        .select("student_id, attendance_date, status, notes")
        .eq("class_id", classId)
        .gte("attendance_date", historyStart)
        .lte("attendance_date", attendanceDate),
    ]);

    if (enrollmentsRes.error) {
      logServerError("class-attendance.loadEnrollments", enrollmentsRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }
    if (recordsRes.error) {
      logServerError("class-attendance.loadRecords", recordsRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const todayByStudent = new Map<
      string,
      { status: AttendanceStatus | null; notes: string | null }
    >();
    const historyRecords: { attendanceDate: string; studentId: string }[] = [];

    for (const row of recordsRes.data ?? []) {
      historyRecords.push({
        attendanceDate: row.attendance_date,
        studentId: row.student_id,
      });
      if (row.attendance_date !== attendanceDate) continue;
      todayByStudent.set(row.student_id, {
        status: parseStatus(row.status),
        notes: row.notes,
      });
    }

    const roster: ClassAttendanceRosterRow[] = [];
    for (const raw of enrollmentsRes.data ?? []) {
      const student = unwrapOne(
        (raw as { students: StudentEmbed | StudentEmbed[] | null }).students,
      );
      if (!student?.id) continue;
      const saved = todayByStudent.get(student.id);
      roster.push({
        studentId: student.id,
        displayName: teacherStudentDisplayName({
          preferredName: student.preferred_name,
          firstName: student.first_name ?? "",
          lastName: student.last_name ?? "",
        }),
        status: saved?.status ?? null,
        notes: saved?.notes ?? null,
      });
    }

    roster.sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
    );

    const savedTally = tallyClassAttendance(roster);
    const completion = attendanceStatusForClass({
      studentCount: roster.length,
      markedCount: savedTally.marked,
    });

    return {
      ok: true,
      classId,
      schoolYearLabel,
      attendanceDate,
      studentCountLabel: studentCountLabel(roster.length),
      completion,
      completionLabel: attendancePulseLabel(completion),
      roster,
      history: buildClassAttendanceHistory({
        enrolledCount: roster.length,
        records: historyRecords,
        excludeDate: attendanceDate,
      }),
    };
  },
);
