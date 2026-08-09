/**
 * Student profile data facades — implemented in `supabase-profile-data.ts`.
 */
export {
  getAuditEvents,
  getReportCardSummaries,
  getStudentFiles,
  getStudentGrades,
  getStudentProfile,
  getTransitionNotes,
  loadAuditEventsForStudent,
  loadReportCardFileRows,
  loadReportCardSummariesForTab,
  loadStudentFiles,
  loadStudentProfileResult,
  loadTransitionNotes,
} from "./supabase-profile-data";

export { loadStudentIntelligence } from "./load-student-intelligence";
export { loadStudentShellMetrics } from "./load-student-shell-metrics";
export type { StudentShellMetrics } from "./load-student-shell-metrics";
export type {
  StudentIntelligence,
  StudentIntelligenceResult,
} from "./load-student-intelligence";
