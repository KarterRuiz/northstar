/**
 * Pure Records-tab helpers — summaries and nested view routing.
 * Completion lists live here, not on Teacher Home or every roster row.
 */

import {
  studentReportPresence,
  type ReportingFileInput,
  type StudentReportPresence,
} from "@/features/report-cards/reporting-progress";

export const CLASS_RECORDS_VIEWS = ["report-cards", "transition-notes"] as const;

export type ClassRecordsView = (typeof CLASS_RECORDS_VIEWS)[number];

export function parseClassRecordsView(
  raw: string | string[] | undefined | null,
): ClassRecordsView | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "report-cards" || value === "transition-notes") return value;
  return null;
}

export type ClassRecordsReportSummary = {
  started: boolean;
  isCurrentYear: boolean;
  enrolledCount: number;
  completeCount: number | null;
  /** Primary line under the title (e.g. "Not started", "18 of 31 complete"). */
  primary: string;
  /** Optional second line when reporting is active and incomplete. */
  secondary: string | null;
};

export function summarizeClassReportCards(args: {
  isCurrentYear: boolean;
  reportingStarted: boolean;
  enrolledCount: number;
  completeCount: number | null;
}): ClassRecordsReportSummary {
  const enrolled = Math.max(0, args.enrolledCount);

  if (!args.isCurrentYear) {
    return {
      started: false,
      isCurrentYear: false,
      enrolledCount: enrolled,
      completeCount: null,
      primary: "Previous year",
      secondary: null,
    };
  }

  if (!args.reportingStarted || enrolled <= 0 || args.completeCount == null) {
    return {
      started: false,
      isCurrentYear: true,
      enrolledCount: enrolled,
      completeCount: null,
      primary: "Not started",
      secondary: null,
    };
  }

  const complete = Math.min(enrolled, Math.max(0, args.completeCount));
  const remaining = Math.max(0, enrolled - complete);
  return {
    started: true,
    isCurrentYear: true,
    enrolledCount: enrolled,
    completeCount: complete,
    primary: `${complete} of ${enrolled} complete`,
    secondary: remaining > 0 ? `${remaining} remaining` : null,
  };
}

export type ClassRecordsTransitionSummary = {
  relevant: boolean;
  enrolledCount: number;
  submittedCount: number;
  remaining: number;
  primary: string;
};

export function summarizeClassTransitionNotes(args: {
  workflowStarted: boolean;
  enrolledCount: number;
  submittedCount: number;
}): ClassRecordsTransitionSummary {
  const enrolled = Math.max(0, args.enrolledCount);
  const submitted = Math.min(enrolled, Math.max(0, args.submittedCount));
  const remaining = Math.max(0, enrolled - submitted);
  const relevant = args.workflowStarted && enrolled > 0;

  return {
    relevant,
    enrolledCount: enrolled,
    submittedCount: submitted,
    remaining,
    primary: remaining === 0 ? "Complete" : `${remaining} remaining`,
  };
}

export type ClassRecordStudentStatus =
  | "complete"
  | "draft"
  | "not_started"
  | "previous_year";

export function reportCardStudentStatus(
  presence: StudentReportPresence,
): ClassRecordStudentStatus {
  if (presence === "final") return "complete";
  if (presence === "draft") return "draft";
  return "not_started";
}

export function reportCardStudentStatusLabel(
  status: ClassRecordStudentStatus,
): string {
  if (status === "complete") return "Complete";
  if (status === "draft") return "Draft";
  if (status === "previous_year") return "Previous year";
  return "Not started";
}

export function transitionStudentStatus(args: {
  hasNote: boolean;
  submitted: boolean;
}): ClassRecordStudentStatus {
  if (args.submitted) return "complete";
  if (args.hasNote) return "draft";
  return "not_started";
}

export function transitionStudentStatusLabel(
  status: ClassRecordStudentStatus,
): string {
  if (status === "complete") return "Complete";
  if (status === "draft") return "In progress";
  return "Not started";
}

export function buildReportCardStudentRows(args: {
  students: { studentId: string; displayName: string }[];
  files: ReportingFileInput[];
  term: string | null;
  reportingStarted: boolean;
  isCurrentYear: boolean;
}): {
  studentId: string;
  displayName: string;
  status: ClassRecordStudentStatus;
  statusLabel: string;
}[] {
  if (!args.isCurrentYear || !args.reportingStarted || !args.term) {
    return [];
  }

  return args.students.map((student) => {
    const presence = studentReportPresence(args.files, student.studentId, args.term!);
    const status = reportCardStudentStatus(presence);
    return {
      studentId: student.studentId,
      displayName: student.displayName,
      status,
      statusLabel: reportCardStudentStatusLabel(status),
    };
  });
}

export function buildTransitionStudentRows(args: {
  students: { studentId: string; displayName: string }[];
  submittedIds: Set<string>;
  noteIds: Set<string>;
  workflowStarted: boolean;
}): {
  studentId: string;
  displayName: string;
  status: ClassRecordStudentStatus;
  statusLabel: string;
}[] {
  if (!args.workflowStarted) return [];

  return args.students.map((student) => {
    const status = transitionStudentStatus({
      hasNote: args.noteIds.has(student.studentId),
      submitted: args.submittedIds.has(student.studentId),
    });
    return {
      studentId: student.studentId,
      displayName: student.displayName,
      status,
      statusLabel: transitionStudentStatusLabel(status),
    };
  });
}
