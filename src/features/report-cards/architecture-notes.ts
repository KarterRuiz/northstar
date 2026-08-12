/**
 * Product / schema notes for Student Reports. Keep the Report Cards workspace
 * ready to coexist with Progress Reports later — do not overload this table.
 */

export const REPORT_CARDS_WORKSPACE_SCOPE =
  "The Report Cards workspace is the leadership command center for official term report cards (`report_card_files` + optional `report_card_comments`). It tracks cycle, class, and student completion for the current school year / term. It is not a file-upload utility and must not invent deadlines, coverage percentages, or teacher ownership.";

/**
 * Progress Reports are not a product yet. Do not reuse `report_card_files.status`
 * (draft / final / archive) or `source` (uploaded / generated) for mid-term
 * progress notes — those columns describe official report-card PDFs only.
 *
 * Recommended future shape (requires a migration when the product ships):
 * - Table `progress_reports` (or term-scoped files) keyed by
 *   `student_id` + `school_year_id` + `term` / `period`
 * - Optional `class_id` and `teacher_profile_id` for authorship
 * - Own status vocabulary (e.g. draft / shared) — not report-card final/archive
 * - Separate storage prefix; do not mix PDFs in the `report-cards` bucket paths
 *
 * UI: add a sibling surface under Student Reports / Reporting
 * (Report Cards | Progress Reports). The current tab shell is the Report Cards
 * half of that pair. Staff profile can then aggregate progress completion for
 * students in the teacher's assigned classes.
 */
export const PROGRESS_REPORTS_ARCHITECTURE =
  "Progress reports are not a product yet. Recommended shape: a separate `progress_reports` table keyed by `student_id` + `school_year_id` + `term`/`period`, with optional `class_id` and `teacher_profile_id` for authorship. Do not overload `report_card_files`. Schema work is required before shipping. The Report Cards workspace tabs are the Report Cards half of a future Student Reports / Reporting pair.";
