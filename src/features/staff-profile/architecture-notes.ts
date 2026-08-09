/**
 * Schema / product decisions for staff professional record areas that are not
 * fully modeled yet. Keep UI empty states honest — do not invent parallel tables.
 */

export const STAFF_TRANSITION_NOTES_ARCHITECTURE =
  "Student transition notes (`transition_notes`) are keyed by `student_id` and `author_profile_id`. Staff profiles surface notes authored by the linked profile — not a separate staff handoff table. A dedicated `staff_transition_notes` table would only be needed for staff-to-staff continuity (separate from student records).";

export const STAFF_OBSERVATIONS_ARCHITECTURE =
  "Classroom observations and formal feedback are not modeled yet. A future `staff_observations` table would key off `staff_members.id`, with author/profile and school-year context — separate from student behavior_records.";

export const STAFF_GROWTH_ARCHITECTURE =
  "Professional growth / evaluation is not built. Avoid bolting eval onto student growth routes. Future `staff_growth_goals` / `staff_evaluations` should reference `staff_members.id` only.";

export const STAFF_FILES_ARCHITECTURE =
  "Staff file storage is not provisioned. Student documents use student-scoped storage paths; staff PDFs would need a dedicated bucket prefix keyed by `staff_members.id`.";

export const STAFF_COVERAGE_ARCHITECTURE =
  "`staff_attendance` is coverage-ready: when a status implies absence, a future `staff_coverage` table can reference `staff_attendance.id`, covering `staff_member_id`, and `class_id`. Do not store coverage rows inside attendance.";

export const STAFF_PROFILE_ATTENDANCE_SCOPE =
  "Staff Profile is a leadership surface: the Attendance Compliance tab tracks whether the teacher's assigned classes have student attendance submitted (same completion rule as admin attendance: markedCount >= enrolled). Personal staff presence (`staff_attendance`) belongs on the admin Staff Today panel / HR-style workflows — not on the staff profile header, overview, or attendance tab.";

export const STAFF_PROGRESS_REPORTS_ARCHITECTURE =
  "Progress reports are not a product yet. Recommended shape: `progress_reports` (or term-scoped files) keyed by `student_id` + `school_year_id` + `term`/`period`, with optional `class_id` and `teacher_profile_id` for authorship — mirroring `report_card_files` / `report_card_comments` without overloading report-card status. Staff profile would aggregate completion for students in the teacher's assigned classes. Schema work will be required before shipping.";

export const STAFF_GRADEBOOK_LEADERSHIP_ACCESS =
  "Class gradebooks remain teacher-scoped (`requireTeacherAssignedToClass`). Leadership reviews academic completion via Academic Review and the report-card registry; staff profile links to those surfaces instead of broadening gradebook write routes.";
