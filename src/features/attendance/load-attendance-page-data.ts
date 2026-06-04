import "server-only";

import { cache } from "react";

import { loadSchoolYearTermContext } from "@/features/attendance-behavior/load-support-flag-data";
import { ATTENDANCE_ABSENCE_THRESHOLD } from "@/features/interventions/support-flags";
import {
  hasAttendanceConcernMetrics,
  tallyAttendanceConcernMetrics,
} from "./attendance-concerns";
import { loadTeacherWorkspaceData } from "@/features/teacher/dashboard/load-teacher-workspace-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import type { AttendanceStatus } from "./schema";
import { attendanceStatuses } from "./schema";

export type AttendanceRosterRow = {
  studentId: string;
  displayName: string;
  gradeName: string;
  status: AttendanceStatus | null;
  notes: string | null;
  recordId: string | null;
};

export type AttendancePageStats = {
  rosterTotal: number;
  markedToday: number;
  absenceCount: number;
  tardyCount: number;
  repeatedAbsenceStudents: { studentId: string; displayName: string; count: number }[];
};

export type AttendancePageData =
  | {
      ok: true;
      classes: { id: string; label: string; schoolYearLabel: string }[];
      classId: string | null;
      schoolYearLabel: string;
      attendanceDate: string;
      roster: AttendanceRosterRow[];
      stats: AttendancePageStats;
    }
  | { ok: false; message: string };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseStatus(value: string | null): AttendanceStatus | null {
  if (value && attendanceStatuses.includes(value as AttendanceStatus)) {
    return value as AttendanceStatus;
  }
  return null;
}

export const loadAttendancePageData = cache(async function loadAttendancePageData(args: {
  classId: string | null;
  attendanceDate: string | null;
}): Promise<AttendancePageData> {
  const ws = await loadTeacherWorkspaceData();
  if (!ws.ok) return ws;

  const classes = ws.classes
    .filter((c) => c.isActive)
    .map((c) => ({
      id: c.id,
      label: [c.name, c.section, c.gradeName].filter(Boolean).join(" · "),
      schoolYearLabel: c.schoolYearLabel,
    }));

  const classId = args.classId && classes.some((c) => c.id === args.classId)
    ? args.classId
    : classes[0]?.id ?? null;

  if (!classId) {
    return {
      ok: true,
      classes,
      classId: null,
      schoolYearLabel: ws.currentSchoolYearLabel ?? "",
      attendanceDate: args.attendanceDate ?? todayIso(),
      roster: [],
      stats: {
        rosterTotal: 0,
        markedToday: 0,
        absenceCount: 0,
        tardyCount: 0,
        repeatedAbsenceStudents: [],
      },
    };
  }

  const selectedClass = classes.find((c) => c.id === classId)!;
  const attendanceDate = args.attendanceDate ?? todayIso();
  const rosterBase = ws.roster.filter((r) => r.classId === classId);

  let existing: {
    id: string;
    student_id: string;
    status: string;
    notes: string | null;
  }[] = [];

  const supabase = isSupabaseConfigured() ? await createServerSupabaseClient() : null;

  const [existingResult, termCtx] = await Promise.all([
    supabase
      ? supabase
          .from("attendance_records")
          .select("id, student_id, status, notes")
          .eq("class_id", classId)
          .eq("attendance_date", attendanceDate)
      : Promise.resolve({ data: [] as typeof existing, error: null }),
    loadSchoolYearTermContext(),
  ]);

  if (existingResult.error) {
    return { ok: false, message: existingResult.error.message };
  }
  existing = (existingResult.data ?? []) as typeof existing;

  const byStudent = new Map(existing.map((r) => [r.student_id, r]));

  const roster: AttendanceRosterRow[] = rosterBase.map((r) => {
    const row = byStudent.get(r.studentId);
    return {
      studentId: r.studentId,
      displayName: r.displayName,
      gradeName: r.gradeName,
      status: row ? parseStatus(row.status) : null,
      notes: row?.notes ?? null,
      recordId: row?.id ?? null,
    };
  });

  roster.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
  );

  const markedToday = roster.filter((r) => r.status != null).length;
  const absenceCount = roster.filter((r) => r.status === "absent").length;
  const tardyCount = roster.filter((r) => r.status === "tardy").length;

  let repeatedAbsenceStudents: AttendancePageStats["repeatedAbsenceStudents"] = [];

  if (termCtx.ok && supabase && roster.length > 0) {
    const studentIds = roster.map((r) => r.studentId);
    const { data: termRows } = await supabase
      .from("attendance_records")
      .select("student_id, attendance_date, status")
      .eq("class_id", classId)
      .eq("school_year", selectedClass.schoolYearLabel)
      .in("student_id", studentIds)
      .gte("attendance_date", termCtx.termStart)
      .lte("attendance_date", termCtx.termEnd);

    const absencesByStudent = new Map<string, number>();
    for (const row of termRows ?? []) {
      if (row.status !== "absent") continue;
      absencesByStudent.set(
        row.student_id,
        (absencesByStudent.get(row.student_id) ?? 0) + 1,
      );
    }

    repeatedAbsenceStudents = roster
      .map((r) => ({
        studentId: r.studentId,
        displayName: r.displayName,
        count: absencesByStudent.get(r.studentId) ?? 0,
      }))
      .filter((r) => r.count >= ATTENDANCE_ABSENCE_THRESHOLD)
      .sort((a, b) => b.count - a.count);
  }

  return {
    ok: true,
    classes,
    classId,
    schoolYearLabel: selectedClass.schoolYearLabel,
    attendanceDate,
    roster,
    stats: {
      rosterTotal: roster.length,
      markedToday,
      absenceCount,
      tardyCount,
      repeatedAbsenceStudents,
    },
  };
});

export type AttendanceConcernStudent = {
  studentId: string;
  displayName: string;
  classId: string;
  classLabel: string;
  absences: number;
  tardies: number;
};

export async function loadAttendanceConcernStudents(): Promise<
  AttendanceConcernStudent[]
> {
  const [ws, termCtx] = await Promise.all([
    loadTeacherWorkspaceData(),
    loadSchoolYearTermContext(),
  ]);
  if (!ws.ok || !termCtx.ok || !isSupabaseConfigured()) return [];

  const schoolYearLabels = [
    ...new Set(
      ws.classes
        .map((c) => c.schoolYearLabel.trim())
        .filter((label) => label && label !== "—"),
    ),
  ];
  if (schoolYearLabels.length === 0) schoolYearLabels.push(termCtx.schoolYearLabel);

  const supabase = await createServerSupabaseClient();
  const classIds = [...new Set(ws.roster.map((r) => r.classId))];
  const studentIds = [...new Set(ws.roster.map((r) => r.studentId))];
  if (classIds.length === 0) return [];

  const { data } = await supabase
    .from("attendance_records")
    .select("student_id, class_id, attendance_date, status")
    .in("school_year", schoolYearLabels)
    .in("class_id", classIds)
    .in("student_id", studentIds)
    .gte("attendance_date", termCtx.termStart)
    .lte("attendance_date", termCtx.termEnd);

  const out: AttendanceConcernStudent[] = [];
  for (const r of ws.roster) {
    const studentRows = (data ?? [])
      .filter((d) => d.student_id === r.studentId && d.class_id === r.classId)
      .map((d) => ({ attendanceDate: d.attendance_date, status: d.status }));

    const metrics = tallyAttendanceConcernMetrics(
      studentRows,
      termCtx.termStart,
      termCtx.termEnd,
    );
    if (!hasAttendanceConcernMetrics(metrics)) continue;

    out.push({
      studentId: r.studentId,
      displayName: r.displayName,
      classId: r.classId,
      classLabel: r.classLabel,
      absences: metrics.termAbsences,
      tardies: metrics.termTardies,
    });
  }

  return out.sort((a, b) => b.absences - a.absences || a.displayName.localeCompare(b.displayName));
}
