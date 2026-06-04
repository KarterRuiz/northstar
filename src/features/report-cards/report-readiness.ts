/**
 * Client-safe re-exports for report card UI (readiness rules live in gradebook).
 */
export {
  computeStudentReportReadiness as computeReportReadiness,
  reportReadinessStatusLabel,
  transitionNoteStatusLabel,
} from "@/features/teacher/gradebook/report-readiness";
