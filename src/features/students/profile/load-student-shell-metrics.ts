import "server-only";

import { cache } from "react";

import type { Role } from "@/config/roles";
import { loadStudentAttendanceProfile } from "@/features/attendance-behavior/load-student-attendance-profile";
import { loadStudentBehaviorProfile } from "@/features/attendance-behavior/load-student-behavior-profile";
import { formatOverallGrade } from "@/features/teacher/gradebook/calculations";

import { loadStudentIntelligence } from "./load-student-intelligence";

export type StudentShellMetrics = {
  attendancePercent: number | null;
  academicAverageLabel: string;
  behaviorStatusLabel: string;
};

export const loadStudentShellMetrics = cache(
  async (studentId: string, role: Role): Promise<StudentShellMetrics> => {
    const [attendance, behavior, intel] = await Promise.all([
      loadStudentAttendanceProfile(studentId, role),
      loadStudentBehaviorProfile(studentId, role),
      loadStudentIntelligence(studentId, { viewerRole: role }),
    ]);

    const attendancePercent =
      attendance.ok === true ? attendance.termAttendancePct : null;

    let academicAverageLabel = "—";
    if (intel.kind === "ok" && intel.data.readiness.overallPercent !== null) {
      academicAverageLabel = formatOverallGrade({
        percent: intel.data.readiness.overallPercent,
        letter: intel.data.readiness.overallLetter,
        isPartial: intel.data.readiness.isPartialGrade,
      });
    }

    let behaviorStatusLabel = "—";
    if (behavior.ok === true) {
      if (behavior.concernCount > 0) {
        behaviorStatusLabel =
          behavior.concernCount === 1
            ? "1 open concern"
            : `${behavior.concernCount} open concerns`;
      } else if (behavior.positiveCount > 0) {
        behaviorStatusLabel = "Recognition-forward";
      } else if (behavior.recent.length > 0) {
        behaviorStatusLabel = "Documented";
      } else {
        behaviorStatusLabel = "No term entries";
      }
    }

    return {
      attendancePercent,
      academicAverageLabel,
      behaviorStatusLabel,
    };
  },
);
