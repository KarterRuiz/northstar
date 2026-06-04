import type { ReportReadinessStatus } from "@/features/teacher/gradebook/report-readiness";

/** Snapshot report cards always generate; missing data shows placeholders in the PDF. */
export function canGenerateReportCard(status: ReportReadinessStatus): boolean {
  void status;
  return true;
}

export function generateReportCardBlockedReason(
  status: ReportReadinessStatus,
): string | null {
  void status;
  return null;
}
