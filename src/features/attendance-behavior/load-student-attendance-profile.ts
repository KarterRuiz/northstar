import "server-only";

import { cache } from "react";

import {
  hasAttendanceConcernMetrics,
  tallyAttendanceConcernMetrics,
} from "@/features/attendance/attendance-concerns";
import {
  getAttendanceRiskTier,
  getSuggestedAttendanceAction,
  type AttendanceRiskTier,
} from "@/features/attendance/attendance-risk-tier";
import {
  attendancePercent,
  statusCountsInRange,
} from "@/features/attendance/attendance-metrics";
import {
  monthRangeContaining,
  previousMonthRange,
  previousWeekRange,
  weekRangeContaining,
} from "@/features/attendance/attendance-date-utils";
import {
  compareAttendanceTrend,
  type AttendanceTrendResult,
} from "@/features/attendance/attendance-trend";
import { loadSchoolYearTermContext } from "@/features/attendance-behavior/load-support-flag-data";
import { attendanceStatusLabels, type AttendanceStatus } from "@/features/attendance/schema";
import { loadStudentIntelligence } from "@/features/students/profile/load-student-intelligence";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Role } from "@/config/roles";

export type StudentAttendanceRecord = {
  id: string;
  attendanceDate: string;
  status: AttendanceStatus;
  notes: string | null;
};

export type StudentAttendanceProfile =
  | {
      ok: true;
      classId: string;
      studentDisplayName: string;
      termAbsences: number;
      termTardies: number;
      termExcused: number;
      termAttendancePct: number | null;
      absenceConcern: boolean;
      tardyConcern: boolean;
      riskTier: AttendanceRiskTier;
      suggestedAction: string | null;
      monthlySummary: {
        monthLabel: string;
        daysMarked: number;
        absences: number;
        tardies: number;
        attendancePct: number | null;
        trend: AttendanceTrendResult;
      };
      weeklyTrend: AttendanceTrendResult;
      recent: StudentAttendanceRecord[];
    }
  | { ok: false; message: string };

export const loadStudentAttendanceProfile = cache(async function loadStudentAttendanceProfile(
  studentId: string,
  role: Role,
): Promise<StudentAttendanceProfile> {
  const intel = await loadStudentIntelligence(studentId, { viewerRole: role });
  if (intel.kind !== "ok") {
    return { ok: false, message: "No active enrollment for attendance." };
  }

  const { classId, schoolYearLabel } = intel.data;
  const termCtx = await loadSchoolYearTermContext();
  if (!termCtx.ok) return { ok: false, message: termCtx.message };

  const studentDisplayName =
    intel.data.className.split("·")[0]?.trim() || "Student";

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      classId,
      studentDisplayName,
      termAbsences: 0,
      termTardies: 0,
      termExcused: 0,
      termAttendancePct: null,
      absenceConcern: false,
      tardyConcern: false,
      riskTier: "healthy",
      suggestedAction: null,
      monthlySummary: {
        monthLabel: new Date().toISOString().slice(0, 7),
        daysMarked: 0,
        absences: 0,
        tardies: 0,
        attendancePct: null,
        trend: null,
      },
      weeklyTrend: null,
      recent: [],
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: termData, error } = await supabase
    .from("attendance_records")
    .select("id, attendance_date, status, notes")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("school_year", schoolYearLabel)
    .gte("attendance_date", termCtx.termStart)
    .lte("attendance_date", termCtx.termEnd)
    .order("attendance_date", { ascending: false });

  if (error) return { ok: false, message: error.message };

  const rows = (termData ?? []).map((r) => ({
    id: r.id,
    attendanceDate: r.attendance_date,
    status: r.status as AttendanceStatus,
    notes: r.notes,
  }));

  const termRows = rows.map((r) => ({
    attendanceDate: r.attendanceDate,
    status: r.status,
  }));
  const termTally = statusCountsInRange(
    termRows,
    termCtx.termStart,
    termCtx.termEnd,
  );
  const concernMetrics = tallyAttendanceConcernMetrics(
    termRows,
    termCtx.termStart,
    termCtx.termEnd,
  );

  const today = new Date().toISOString().slice(0, 10);
  const { start: monthStart, end: monthEnd } = monthRangeContaining(today);
  const { start: prevMonthStart, end: prevMonthEnd } = previousMonthRange(monthStart);
  const monthTally = statusCountsInRange(termRows, monthStart, monthEnd);
  const prevMonthTally = statusCountsInRange(termRows, prevMonthStart, prevMonthEnd);
  const monthlyTrend = compareAttendanceTrend(
    attendancePercent(monthTally),
    attendancePercent(prevMonthTally),
  );

  const { start: weekStart, end: weekEnd } = weekRangeContaining(today);
  const { start: prevWeekStart, end: prevWeekEnd } = previousWeekRange(weekStart);
  const weekTally = statusCountsInRange(termRows, weekStart, weekEnd);
  const prevWeekTally = statusCountsInRange(termRows, prevWeekStart, prevWeekEnd);
  const weeklyTrend = compareAttendanceTrend(
    attendancePercent(weekTally),
    attendancePercent(prevWeekTally),
  );

  const riskTier = getAttendanceRiskTier(concernMetrics);
  const hasConcern = hasAttendanceConcernMetrics(concernMetrics);

  const { data: studentRow } = await supabase
    .from("students")
    .select("first_name, last_name, preferred_name")
    .eq("id", studentId)
    .maybeSingle();

  const display =
    studentRow?.preferred_name?.trim() ||
    [studentRow?.first_name, studentRow?.last_name].filter(Boolean).join(" ").trim() ||
    studentDisplayName;

  return {
    ok: true,
    classId,
    studentDisplayName: display,
    termAbsences: termTally.absent,
    termTardies: termTally.tardy,
    termExcused: termTally.excused,
    termAttendancePct: attendancePercent(termTally),
    absenceConcern: hasConcern,
    tardyConcern: concernMetrics.termTardies >= 5,
    riskTier,
    suggestedAction: getSuggestedAttendanceAction(riskTier),
    monthlySummary: {
      monthLabel: monthStart.slice(0, 7),
      daysMarked: monthTally.marked,
      absences: monthTally.absent,
      tardies: monthTally.tardy,
      attendancePct: attendancePercent(monthTally),
      trend: monthlyTrend,
    },
    weeklyTrend,
    recent: rows.slice(0, 12),
  };
});

export { attendanceStatusLabels };
