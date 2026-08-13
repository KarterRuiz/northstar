/**
 * Admin Class Data Center = leadership observation / review / navigate.
 * Teacher Class Workspace = instructional create / enter.
 *
 * Do NOT become another gradebook editor, attendance-entry UI, analytics
 * dashboard, or duplicate of Teacher Class Workspace.
 *
 * Navigation: Admin Home → Classes → Class Data Center → Student / Staff Profile.
 * Route pattern matches Teacher Class Workspace nested tabs under
 * /dashboard/[role]/classes/[classId]/… with role-aware shells.
 *
 * Academics is read-only by default. Grade mutations stay teacher-gated via
 * requireTeacherAssignedToClass — UI mode="read-only" is defense in depth.
 */
export const CLASS_DATA_CENTER_ARCHITECTURE_NOTES = [
  "Layout loads lightweight class context only. Each tab loads its own data.",
  "Leadership roles (canManageSchoolStructure) get the Data Center; teachers keep Class Workspace.",
  "Header uses human language only — no UUIDs, table names, or resolver copy.",
  "Staffing reads staff_member_classes (canonical); links use staffProfilePath.",
  "Roster names use preferred_name, then first + last — same as Student Profile.",
  "Attendance is review + deep-link to existing attendance workspace — not silent entry.",
  "Academics reuses GradebookView in mode=read-only; mutations remain teacher-only.",
  "Support reuses loadCheckInSignals / pickCheckInReason — same as Teacher Home.",
  "Records reuses report-card honesty helpers — Not started vs remaining.",
  "Actions reuse existing Edit class / Manage teachers / Archive dialogs.",
  "Navigation alone must not write audit events.",
] as const;
