import {
  classBelongsToCurrentYear,
  formatAssignmentRole,
} from "@/features/teacher/dashboard/teacher-home-summaries";

export function formatClassWorkspaceMeta(args: {
  gradeName: string;
  assignmentRole: string;
  studentCount: number;
}): string {
  const grade = args.gradeName.trim() && args.gradeName !== "—" ? args.gradeName.trim() : null;
  const role = formatAssignmentRole(args.assignmentRole);
  const students =
    args.studentCount === 1 ? "1 student" : `${Math.max(0, args.studentCount)} students`;
  return [grade, role, students].filter(Boolean).join(" · ");
}

export function classIsCurrentSchoolYear(
  classYearId: string | null,
  currentYearId: string | null,
): boolean {
  if (!currentYearId) return true;
  return classBelongsToCurrentYear(classYearId, currentYearId);
}

export function attendancePulseLabel(
  status: "complete" | "not_submitted" | "not_required",
): string {
  if (status === "complete") return "Complete";
  if (status === "not_submitted") return "Not submitted";
  return "No roster yet";
}

export function reportCardsPulseLabel(args: {
  isCurrentYear: boolean;
  reportingStarted: boolean;
  enrolledCount: number;
  completeCount: number | null;
}): string {
  if (!args.isCurrentYear) return "Previous year";
  if (!args.reportingStarted || args.enrolledCount <= 0 || args.completeCount == null) {
    return "Not started";
  }
  const complete = Math.min(args.enrolledCount, Math.max(0, args.completeCount));
  if (complete >= args.enrolledCount) {
    return `${complete} of ${args.enrolledCount} complete`;
  }
  return `${args.enrolledCount - complete} remaining`;
}

export function checkInPulseLabel(count: number): string {
  return String(Math.max(0, count));
}

export function studentCountLabel(count: number): string {
  return count === 1 ? "1 student" : `${Math.max(0, count)} students`;
}
