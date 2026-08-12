import "server-only";

import { cache } from "react";

import { loadAdminAttendanceData } from "./load-admin-attendance-data";

export type AdminAttendanceOverviewMetrics = {
  absencesToday: number;
  classesNotSubmitted: number;
  studentsNeedingFollowUp: number;
  /** Student mark completion across active classes today (0–100). */
  completionPct: number;
  /** Teachers with at least one class still missing today's submission. */
  teachersWithMissingAttendance: number;
  /** True when there is at least one active class with enrolled students. */
  hasClassesExpectingAttendance: boolean;
};

export const loadAdminAttendanceOverviewMetrics = cache(
  async (): Promise<AdminAttendanceOverviewMetrics> => {
    const data = await loadAdminAttendanceData({
      date: null,
      schoolYear: null,
      gradeId: null,
      classId: null,
      status: null,
    });
    if (!data.ok) {
      return {
        absencesToday: 0,
        classesNotSubmitted: 0,
        studentsNeedingFollowUp: 0,
        completionPct: 0,
        teachersWithMissingAttendance: 0,
        hasClassesExpectingAttendance: false,
      };
    }
    const hasClassesExpectingAttendance = data.classRows.some(
      (r) => r.totalStudents > 0,
    );
    return {
      absencesToday: data.summary.absencesToday,
      classesNotSubmitted: data.summary.classesNotSubmitted,
      studentsNeedingFollowUp: data.followUpRows.length,
      completionPct: data.summary.completionPct,
      teachersWithMissingAttendance: data.summary.teachersWithMissingAttendance,
      hasClassesExpectingAttendance,
    };
  },
);
