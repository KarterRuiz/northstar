import type {
  InterventionSeverity,
  InterventionStatus,
  InterventionType,
} from "./schema";
import type { AcademicFlag } from "./academic-flags";

export type StudentInterventionRow = {
  id: string;
  studentId: string;
  classId: string;
  schoolYearId: string;
  interventionType: InterventionType;
  status: InterventionStatus;
  severity: InterventionSeverity;
  title: string;
  description: string;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  followUpDate: string | null;
};

export type InterventionsDashboardStudentRow = {
  studentId: string;
  displayName: string;
  classId: string;
  classLabel: string;
  gradeName: string;
  overallPercent: number | null;
  overallLetter: string | null;
  isPartialGrade: boolean;
  missingAssignmentCount: number;
  flags: AcademicFlag[];
  activeIntervention: StudentInterventionRow | null;
  interventionCount: number;
  lastUpdate: string | null;
  status: InterventionStatus | "none";
};

export type InterventionsDashboardSummary = {
  activeInterventions: number;
  studentsFlagged: number;
  missingWorkAlerts: number;
  academicRiskAlerts: number;
  enrichmentCandidates: number;
};
