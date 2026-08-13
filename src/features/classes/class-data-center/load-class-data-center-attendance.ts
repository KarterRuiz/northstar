import "server-only";

import { cache } from "react";

import type { Role } from "@/config/roles";
import type { AttendanceStatus } from "@/features/attendance/schema";
import { attendanceStatuses } from "@/features/attendance/schema";
import { addSchoolDays, schoolTodayIso } from "@/features/calendar/school-timezone";
import {
  attendanceStatusForClass,
  type TeacherAttendanceStatus,
} from "@/features/teacher/dashboard/teacher-home-summaries";
import {
  buildClassAttendanceHistory,
  CLASS_ATTENDANCE_HISTORY_LOOKBACK_DAYS,
  parseClassAttendanceDate,
  tallyClassAttendance,
  type ClassAttendanceHistoryRow,
} from "@/features/teacher/class-workspace/class-attendance";
import { attendancePulseLabel, studentCountLabel } from "@/features/teacher/class-workspace/class-workspace-copy";
import { teacherStudentDisplayName } from "@/features/teacher/class-workspace/class-roster";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  classDataCenterAttendanceWorkspaceHref,
  classDataCenterStudentProfileHref,
} from "./constants";
import { loadClassDataCenterContext } from "./load-class-data-center-context";

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

function statusLabel(status: AttendanceStatus | null): string {
  if (!status) return "Not marked";
  switch (status) {
    case "present":
      return "Present";
    case "absent":
      return "Absent";
    case "tardy":
      return "Tardy";
    case "excused":
      return "Excused";
    case "partial":
      return "Partial day";
    default:
      return status;
  }
}

export type ClassDataCenterAttendanceRow = {
  studentId: string;
  displayName: string;
  status: AttendanceStatus | null;
  statusLabel: string;
  notes: string | null;
  href: string;
};

export type ClassDataCenterAttendanceData =
  | {
      ok: true;
      role: Role;
      classId: string;
      attendanceDate: string;
      studentCountLabel: string;
      completion: TeacherAttendanceStatus;
      completionLabel: string;
      roster: ClassDataCenterAttendanceRow[];
      history: ClassAttendanceHistoryRow[];
      openAttendanceHref: string | null;
      isActive: boolean;
    }
  | { ok: false; message: string };

export const loadClassDataCenterAttendance = cache(
  async (
    classId: string,
    attendanceDateRaw: string | null,
  ): Promise<ClassDataCenterAttendanceData> => {
    const ctx = await loadClassDataCenterContext(classId);
    if (!ctx.ok) return ctx;
    if (!isSupabaseConfigured()) {
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const supabase = await createServerSupabaseClient();
    const attendanceDate = parseClassAttendanceDate(attendanceDateRaw, schoolTodayIso());
    const historyStart = addSchoolDays(
      attendanceDate,
      -CLASS_ATTENDANCE_HISTORY_LOOKBACK_DAYS,
    );
    const { role, isActive } = ctx.context;

    const [enrollmentsRes, recordsRes] = await Promise.all([
      supabase
        .from("student_enrollments")
        .select(
          `
          student_id,
          students!inner (
            id, first_name, last_name, preferred_name
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
      logServerError("class-data-center-attendance.enrollments", enrollmentsRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }
    if (recordsRes.error) {
      logServerError("class-data-center-attendance.records", recordsRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const rosterBase: { studentId: string; displayName: string }[] = [];
    for (const raw of enrollmentsRes.data ?? []) {
      const student = unwrapOne(
        (raw as { students: StudentEmbed | StudentEmbed[] | null }).students,
      );
      if (!student?.id) continue;
      rosterBase.push({
        studentId: student.id,
        displayName: teacherStudentDisplayName({
          preferredName: student.preferred_name,
          firstName: student.first_name ?? "",
          lastName: student.last_name ?? "",
        }),
      });
    }
    rosterBase.sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
    );

    const todayByStudent = new Map<string, { status: AttendanceStatus | null; notes: string | null }>();
    for (const row of recordsRes.data ?? []) {
      if (row.attendance_date !== attendanceDate) continue;
      todayByStudent.set(row.student_id, {
        status: parseStatus(row.status),
        notes: row.notes ?? null,
      });
    }

    const roster: ClassDataCenterAttendanceRow[] = rosterBase.map((row) => {
      const mark = todayByStudent.get(row.studentId);
      const status = mark?.status ?? null;
      return {
        studentId: row.studentId,
        displayName: row.displayName,
        status,
        statusLabel: statusLabel(status),
        notes: mark?.notes ?? null,
        href: classDataCenterStudentProfileHref(role, row.studentId),
      };
    });

    const markedCount = roster.filter((r) => r.status != null).length;
    const completion = attendanceStatusForClass({
      studentCount: roster.length,
      markedCount,
    });
    const history = buildClassAttendanceHistory({
      enrolledCount: roster.length,
      excludeDate: attendanceDate,
      records: (recordsRes.data ?? []).map((r) => ({
        attendanceDate: r.attendance_date,
        studentId: r.student_id,
      })),
    });

    return {
      ok: true,
      role,
      classId,
      attendanceDate,
      studentCountLabel: studentCountLabel(roster.length),
      completion,
      completionLabel: attendancePulseLabel(completion),
      roster,
      history,
      openAttendanceHref: classDataCenterAttendanceWorkspaceHref(role, classId, attendanceDate),
      isActive,
    };
  },
);

export { tallyClassAttendance };
