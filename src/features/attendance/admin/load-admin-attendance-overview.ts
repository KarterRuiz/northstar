import "server-only";

import { cache } from "react";

import { loadAdminAttendanceData } from "./load-admin-attendance-data";

export type AdminAttendanceOverviewMetrics = {
  absencesToday: number;
  classesNotSubmitted: number;
  studentsNeedingFollowUp: number;
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
      };
    }
    return {
      absencesToday: data.summary.absencesToday,
      classesNotSubmitted: data.summary.classesNotSubmitted,
      studentsNeedingFollowUp: data.followUpRows.length,
    };
  },
);
