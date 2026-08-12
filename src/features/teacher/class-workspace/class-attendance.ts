import { tallyFromRecords, type AttendanceTally } from "@/features/attendance/attendance-metrics";
import {
  attendanceStatusLabels,
  attendanceStatuses,
  type AttendanceStatus,
} from "@/features/attendance/schema";
import { formatSchoolShortDate, isIsoDate } from "@/features/calendar/school-timezone";
import {
  attendanceStatusForClass,
  type TeacherAttendanceStatus,
} from "@/features/teacher/dashboard/teacher-home-summaries";

import { attendancePulseLabel } from "./class-workspace-copy";
import { classWorkspacePath } from "./constants";

export const CLASS_ATTENDANCE_HISTORY_LIMIT = 5;
export const CLASS_ATTENDANCE_HISTORY_LOOKBACK_DAYS = 14;

export const CLASS_ATTENDANCE_STATUS_SHORT: Record<AttendanceStatus, string> = {
  present: "P",
  absent: "A",
  tardy: "T",
  excused: "E",
  partial: "Pd",
};

export function parseClassAttendanceDate(
  raw: string | null | undefined,
  todayIso: string,
): string {
  const value = raw?.trim() ?? "";
  return isIsoDate(value) ? value : todayIso;
}

export function classAttendanceDateHref(classId: string, date: string): string {
  return `${classWorkspacePath(classId, "attendance")}?date=${date}`;
}

export function defaultClassAttendanceDraft(
  status: AttendanceStatus | null,
): AttendanceStatus {
  return status ?? "present";
}

export function tallyClassAttendance(
  rows: { status: AttendanceStatus | null }[],
): AttendanceTally {
  return tallyFromRecords(
    rows.flatMap((row) => (row.status ? [{ status: row.status }] : [])),
  );
}

/** Teacher-facing counts using official NorthStar statuses only. */
export function classAttendanceTallyLine(tally: AttendanceTally): string {
  const parts = attendanceStatuses
    .map((status) => {
      const count = tally[status];
      if (count <= 0) return null;
      return `${attendanceStatusLabels[status]} ${count}`;
    })
    .filter((part): part is string => part != null);
  return parts.join(" / ");
}

export type ClassAttendanceHistoryRow = {
  date: string;
  dateLabel: string;
  markedCount: number;
  status: TeacherAttendanceStatus;
  statusLabel: string;
};

export function buildClassAttendanceHistory(args: {
  enrolledCount: number;
  records: { attendanceDate: string; studentId: string }[];
  excludeDate: string;
  limit?: number;
}): ClassAttendanceHistoryRow[] {
  const markedByDate = new Map<string, Set<string>>();
  for (const row of args.records) {
    if (row.attendanceDate === args.excludeDate) continue;
    const set = markedByDate.get(row.attendanceDate) ?? new Set<string>();
    set.add(row.studentId);
    markedByDate.set(row.attendanceDate, set);
  }

  const limit = args.limit ?? CLASS_ATTENDANCE_HISTORY_LIMIT;
  return [...markedByDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, limit)
    .map(([date, students]) => {
      const markedCount = students.size;
      const status = attendanceStatusForClass({
        studentCount: args.enrolledCount,
        markedCount,
      });
      return {
        date,
        dateLabel: formatSchoolShortDate(date),
        markedCount,
        status,
        statusLabel: attendancePulseLabel(status),
      };
    });
}
