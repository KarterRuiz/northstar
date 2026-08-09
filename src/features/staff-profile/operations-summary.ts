import type {
  StaffAttendanceCompliance,
  StaffLeadershipMetrics,
  StaffReportCardCompletion,
} from "@/features/staff-profile/load-staff-leadership-metrics";

/** Compact line for today's class attendance submission status. */
export function formatAttendanceTodaySummary(
  compliance: StaffAttendanceCompliance,
): string {
  const { classesExpectedToday, classesSubmittedToday, missingCount } =
    compliance;
  if (classesExpectedToday === 0) return "No classes today";
  if (missingCount === 0) {
    return `${classesSubmittedToday} / ${classesExpectedToday} submitted`;
  }
  return missingCount === 1
    ? "Missing 1 class"
    : `Missing ${missingCount} classes`;
}

export function formatTransitionOpsSummary(metrics: StaffLeadershipMetrics): string {
  if (metrics.transitionPendingReview > 0) {
    return metrics.transitionPendingReview === 1
      ? "1 awaiting review"
      : `${metrics.transitionPendingReview} awaiting review`;
  }
  if (metrics.transitionNotes.length === 0) return "None pending";
  return "None pending";
}

export function formatReportCardOpsSummary(
  reportCards: StaffReportCardCompletion,
): string {
  if (!reportCards.available || !reportCards.coverageKnown) {
    return "Not available";
  }
  if (!reportCards.reportingStarted) {
    return "Cycle not started";
  }
  if (reportCards.totalStudents === 0) {
    return "No enrolled students";
  }
  if (reportCards.remainingCount === 0) {
    return "Complete";
  }
  return reportCards.remainingCount === 1
    ? "1 remaining"
    : `${reportCards.remainingCount} remaining`;
}

export function formatProgressReportsOpsSummary(): string {
  return "Not enabled";
}
