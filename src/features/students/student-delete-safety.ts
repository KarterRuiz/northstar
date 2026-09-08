/**
 * Pure helpers for hard-delete vs archive decisions.
 * Keep free of `"use server"` so client components and tests can import.
 */

export const STUDENT_HISTORY_DEPENDENCIES = [
  { key: "attendance", label: "attendance records", table: "attendance_records" },
  { key: "behavior", label: "behavior / support records", table: "behavior_records" },
  { key: "grades", label: "gradebook scores", table: "gradebook_scores" },
  { key: "academic", label: "academic records", table: "academic_records" },
  { key: "reportCards", label: "report cards", table: "report_card_files" },
  { key: "reportComments", label: "report card comments", table: "report_card_comments" },
  { key: "transitionNotes", label: "transition notes", table: "transition_notes" },
  { key: "interventions", label: "interventions", table: "student_interventions" },
  { key: "parentRequests", label: "parent record requests", table: "parent_record_requests" },
  { key: "followUps", label: "follow-ups", table: "follow_ups" },
  { key: "calendarNotes", label: "calendar notes", table: "calendar_notes" },
] as const;

export type StudentHistoryDependencyKey =
  (typeof STUDENT_HISTORY_DEPENDENCIES)[number]["key"];

export type StudentDeleteSafety = {
  canHardDelete: boolean;
  blockers: { key: StudentHistoryDependencyKey; label: string }[];
};

export function buildStudentDeleteSafety(
  presentKeys: Iterable<StudentHistoryDependencyKey>,
): StudentDeleteSafety {
  const present = new Set(presentKeys);
  const blockers = STUDENT_HISTORY_DEPENDENCIES.filter((d) => present.has(d.key)).map(
    (d) => ({ key: d.key, label: d.label }),
  );
  return {
    canHardDelete: blockers.length === 0,
    blockers,
  };
}

export function studentDeleteBlockedMessage(safety: StudentDeleteSafety): string {
  if (safety.canHardDelete) {
    return "";
  }
  const labels = safety.blockers.map((b) => b.label);
  if (labels.length === 1) {
    return `This student has ${labels[0]}. Remove from class or archive instead of permanently deleting.`;
  }
  if (labels.length === 2) {
    return `This student has ${labels[0]} and ${labels[1]}. Remove from class or archive instead of permanently deleting.`;
  }
  const head = labels.slice(0, -1).join(", ");
  const last = labels[labels.length - 1];
  return `This student has ${head}, and ${last}. Remove from class or archive instead of permanently deleting.`;
}

export function removeFromClassConfirmMessage(
  displayName: string,
  classTitle: string,
): string {
  return `Remove ${displayName} from ${classTitle}? The student record and history will remain in NorthStar.`;
}

export function deleteStudentConfirmMessage(displayName: string): string {
  return `Permanently delete ${displayName}? This action cannot be undone.`;
}

export function archiveStudentConfirmMessage(displayName: string): string {
  return `Archive ${displayName}? Active class enrollments will be withdrawn. The student record and history will remain in NorthStar.`;
}
