import type { AttendanceRiskTier } from "@/features/attendance/attendance-risk-tier";
import type { SupportFlag } from "@/features/interventions/support-flags";
import type {
  ReportReadinessStatus,
  StudentReportReadiness,
  TransitionNoteStatus,
} from "@/features/teacher/gradebook/report-readiness";
import type { SchoolReportBranding } from "@/lib/school-settings/types";
import type { ReportCardTerm } from "@/lib/report-cards/constants";

/** Future: standards-based grading strand summary on the report card. */
export type ReportCardStandardStrand = {
  standardId: string;
  code: string;
  title: string;
  proficiencyLevel: string | null;
  narrativeSummary: string | null;
};

/** Future: subject block with strands and rubric rollups. */
export type ReportCardSubjectStandardsBlock = {
  subjectId: string;
  subjectName: string;
  strands: ReportCardStandardStrand[];
  rubricSummary: string | null;
};

/** Placeholder payload for standards sections (not persisted yet). */
export type ReportCardStandardsPlaceholder = {
  enabled: false;
  subjects: ReportCardSubjectStandardsBlock[];
};

export type ReportCardCommentStatus = "draft" | "complete";

export type ReportCardCommentRow = {
  id: string;
  studentId: string;
  classId: string;
  schoolYearId: string;
  term: ReportCardTerm;
  narrativeComment: string;
  status: ReportCardCommentStatus;
  teacherProfileId: string;
  updatedAt: string;
};

export type ReportCardCategoryAverage = {
  name: string;
  percent: number | null;
  letter: string | null;
};

export type ReportCardAttendanceSummary = {
  termAbsences: number;
  termTardies: number;
  termExcused: number;
  termPartial: number;
  termAttendancePct: number | null;
  riskTier: AttendanceRiskTier | null;
};

export type ReportCardAssignmentSummary = {
  totalInTerm: number;
  gradedCount: number;
  missingCount: number;
};

export type ReportCardBehaviorLine = {
  date: string;
  title: string;
  description: string;
};

export type ReportCardBehaviorSnapshot = {
  positiveRecognitions: ReportCardBehaviorLine[];
  concerns: ReportCardBehaviorLine[];
  parentContacts: ReportCardBehaviorLine[];
  hasRecords: boolean;
};

export type ReportCardInterventionLine = {
  title: string;
  status: string;
  followUpDate: string | null;
  resolvedAt: string | null;
};

export type ReportCardInterventionsSnapshot = {
  active: ReportCardInterventionLine[];
  recentlyResolved: ReportCardInterventionLine[];
};

export type ReportCardPreviewPayload = {
  classId: string;
  className: string;
  classSubtitle: string;
  gradeLevel: string;
  schoolYearLabel: string;
  term: ReportCardTerm;
  studentId: string;
  studentDisplayName: string;
  studentNumber: string | null;
  teacherName: string | null;
  readiness: StudentReportReadiness;
  comment: ReportCardCommentRow | null;
  branding: SchoolReportBranding;
  categoryAverages: ReportCardCategoryAverage[];
  assignmentSummary: ReportCardAssignmentSummary;
  attendance: ReportCardAttendanceSummary | null;
  behavior: ReportCardBehaviorSnapshot;
  interventions: ReportCardInterventionsSnapshot;
  supportFlags: SupportFlag[];
  transitionSummary: string | null;
  dataCurrentAsOf: string;
};

export type ReportCardWorkspaceStudentRow = {
  studentId: string;
  displayName: string;
  readinessStatus: ReportReadinessStatus;
  overallPercent: number | null;
  overallLetter: string | null;
  isPartialGrade: boolean;
  transitionNoteStatus: TransitionNoteStatus;
  missingReportCardTerms: string[];
  reportCardFinalTerms: string[];
  comment: ReportCardCommentRow | null;
};
