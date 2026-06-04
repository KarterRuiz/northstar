import "server-only";

import { cache } from "react";

import { loadSchoolYearTermContext } from "@/features/attendance-behavior/load-support-flag-data";
import { loadTeacherWorkspaceData } from "@/features/teacher/dashboard/load-teacher-workspace-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  evaluateAttendanceConcernFromRecords,
  tallyAttendanceConcernMetrics,
} from "./attendance-concerns";
import {
  getAttendanceRiskTier,
  getSuggestedAttendanceAction,
  type AttendanceRiskTier,
} from "./attendance-risk-tier";

export type AttendanceConcernRow = {
  studentId: string;
  displayName: string;
  classId: string;
  classLabel: string;
  termAbsences: number;
  termTardies: number;
  weekAbsences: number;
  tier: AttendanceRiskTier;
  suggestedAction: string | null;
  kinds: string[];
};

export type AttendanceConcernsData =
  | { ok: true; rows: AttendanceConcernRow[] }
  | { ok: false; message: string };

function schoolYearLabelsForClasses(
  classes: { schoolYearLabel: string }[],
  fallback: string,
): string[] {
  const labels = [
    ...new Set(
      classes.map((c) => c.schoolYearLabel.trim()).filter((label) => label && label !== "—"),
    ),
  ];
  return labels.length > 0 ? labels : fallback ? [fallback] : [];
}

export const loadAttendanceConcernsData = cache(async function loadAttendanceConcernsData(): Promise<AttendanceConcernsData> {
  const [ws, termCtx] = await Promise.all([
    loadTeacherWorkspaceData(),
    loadSchoolYearTermContext(),
  ]);
  if (!ws.ok) return ws;
  if (!termCtx.ok) return { ok: false, message: termCtx.message };
  if (!isSupabaseConfigured()) return { ok: true, rows: [] };

  const schoolYearLabels = schoolYearLabelsForClasses(
    ws.classes,
    termCtx.schoolYearLabel,
  );
  if (schoolYearLabels.length === 0) {
    return { ok: true, rows: [] };
  }

  const supabase = await createServerSupabaseClient();
  const classIds = [...new Set(ws.roster.map((r) => r.classId))];
  const studentIds = [...new Set(ws.roster.map((r) => r.studentId))];
  if (classIds.length === 0) return { ok: true, rows: [] };

  const { data, error } = await supabase
    .from("attendance_records")
    .select("student_id, class_id, attendance_date, status")
    .in("school_year", schoolYearLabels)
    .in("class_id", classIds)
    .in("student_id", studentIds)
    .gte("attendance_date", termCtx.termStart)
    .lte("attendance_date", termCtx.termEnd);

  if (error) return { ok: false, message: error.message };

  const rows: AttendanceConcernRow[] = [];
  for (const r of ws.roster) {
    const studentRows = (data ?? [])
      .filter((d) => d.student_id === r.studentId && d.class_id === r.classId)
      .map((d) => ({ attendanceDate: d.attendance_date, status: d.status }));

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

    rows.push({
      studentId: r.studentId,
      displayName: r.displayName,
      classId: r.classId,
      classLabel: r.classLabel,
      termAbsences: metrics.termAbsences,
      termTardies: metrics.termTardies,
      weekAbsences: metrics.weeklyAbsences,
      tier,
      suggestedAction: getSuggestedAttendanceAction(tier),
      kinds: concern.kinds,
    });
  }

  rows.sort(
    (a, b) =>
      b.termAbsences - a.termAbsences ||
      b.termTardies - a.termTardies ||
      a.displayName.localeCompare(b.displayName),
  );

  return { ok: true, rows };
});
