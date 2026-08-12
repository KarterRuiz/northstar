/**
 * Class Workspace is the teacher’s classroom workbench for one assigned class.
 *
 * Teacher Home = classroom day planner
 * My Classes = which class am I working with?
 * Class Workspace = everything I need to run this class
 * Student Profile = everything I need for this individual student
 *
 * Tabs are distinct jobs. Overview is a pulse — not a second roster.
 * Students is “who is in my class?” and leads into Student Profile.
 * Attendance and Gradebook reuse existing engines inside this class.
 * Support is the class check-in list — who needs human attention.
 * Records owns report cards + transition notes for this class.
 *
 * Official enrollment (add / remove students from a class) is leadership
 * work. Teachers view and teach the assigned roster.
 */
export const CLASS_WORKSPACE_ARCHITECTURE_NOTES = [
  "Reuse the existing /classes/[classId] route. Tabs are nested segments, same pattern as student and staff profiles.",
  "Layout loads lightweight class context only. Each tab loads its own data.",
  "My Classes lists current-year assignments via loadCurrentSchoolYear. Historical assigned classes remain reachable by URL.",
  "Header never explains resolvers, table names, or current-year labels.",
  "Roster names use preferred_name, then first + last — same as Student Profile. No second name resolver.",
  "Students roster is scan-first identity + quiet support. Completion lists live on Records detail, not every roster row.",
  "Attendance tab locks the opened class. It reuses saveAttendanceBulkAction and official statuses. No class picker.",
  "Home, Overview, and the Attendance tab share attendanceStatusForClass on schoolTodayIso().",
  "Gradebook tab embeds the canonical GradebookView for this classId. Do not fork grade logic.",
  "Support reuses the same check-in signals as Teacher Home. Open goes to the existing student interventions tab.",
  "Records uses ?view=report-cards|transition-notes nested state. Actions open existing report-card / transition-note workflows.",
  "Report-card honesty: Not started until reportingHasStarted / resolveReportingCycle says so. Never invent 31 missing cards.",
  "Transition honesty: only show remaining when notes have actually started for students in this class.",
] as const;
