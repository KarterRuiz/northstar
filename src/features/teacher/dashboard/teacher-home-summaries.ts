/** Pure Teacher Home helpers — no server I/O. */

export const TEACHER_HOME_CHECK_IN_LIMIT = 5;

/** When a current year is designated, only that year's classes belong on Today. */
export function classBelongsToCurrentYear(
  classYearId: string | null,
  currentYearId: string | null,
): boolean {
  if (!currentYearId) return true;
  if (!classYearId) return false;
  return classYearId === currentYearId;
}

export type TeacherAttendanceStatus = "complete" | "not_submitted" | "not_required";

export type TeacherCheckInReason =
  | "attendance"
  | "missing_work"
  | "academic"
  | "support"
  | "follow_up"
  | "plan";

export const TEACHER_CHECK_IN_REASON_LABEL: Record<TeacherCheckInReason, string> = {
  attendance: "Attendance follow-up",
  missing_work: "Missing work",
  academic: "Academic follow-up",
  support: "Support follow-up",
  follow_up: "Support follow-up due",
  plan: "Open support plan",
};

const CHECK_IN_PRIORITY: Record<TeacherCheckInReason, number> = {
  attendance: 0,
  missing_work: 1,
  academic: 2,
  support: 3,
  follow_up: 4,
  plan: 5,
};

export function attendanceStatusForClass(args: {
  studentCount: number;
  markedCount: number;
}): TeacherAttendanceStatus {
  if (args.studentCount <= 0) return "not_required";
  if (args.markedCount >= args.studentCount) return "complete";
  return "not_submitted";
}

export function formatAssignmentRole(role: string): string {
  const trimmed = role.trim();
  if (!trimmed || trimmed === "teacher") return "Teacher";
  if (trimmed === "grade_access") return "Grade access";
  return trimmed
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatClassTitle(name: string, section: string | null): string {
  const base = name.trim() || "Class";
  const sec = section?.trim();
  if (!sec) return base;
  if (base.toLowerCase().includes(sec.toLowerCase())) return base;
  return `${base} · ${sec}`;
}

export type TeacherCheckInFlags = {
  attendanceConcern: boolean;
  missingWork: boolean;
  academicRisk: boolean;
  behaviorConcern: boolean;
  followUpDue: boolean;
  openPlan: boolean;
};

export function pickCheckInReason(flags: TeacherCheckInFlags): TeacherCheckInReason | null {
  if (flags.attendanceConcern) return "attendance";
  if (flags.missingWork) return "missing_work";
  if (flags.academicRisk) return "academic";
  if (flags.behaviorConcern) return "support";
  if (flags.followUpDue) return "follow_up";
  if (flags.openPlan) return "plan";
  return null;
}

/** Actual missing-work count when known — never threshold copy like "2+". */
export function checkInDetailLabel(args: {
  reason: TeacherCheckInReason;
  missingAssignmentCount: number;
}): string {
  if (args.reason === "missing_work" && args.missingAssignmentCount > 0) {
    return args.missingAssignmentCount === 1
      ? "1 missing assignment"
      : `${args.missingAssignmentCount} missing assignments`;
  }
  return TEACHER_CHECK_IN_REASON_LABEL[args.reason];
}

export function rankCheckInStudents<
  T extends { studentId: string; reason: TeacherCheckInReason },
>(rows: T[], limit = TEACHER_HOME_CHECK_IN_LIMIT): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  const sorted = [...rows].sort(
    (a, b) => CHECK_IN_PRIORITY[a.reason] - CHECK_IN_PRIORITY[b.reason],
  );
  for (const row of sorted) {
    if (seen.has(row.studentId)) continue;
    seen.add(row.studentId);
    unique.push(row);
    if (unique.length >= limit) break;
  }
  return unique;
}

export type TeacherRecordsSummary = {
  due: boolean;
  emptyLabel: string;
  transition: {
    relevant: boolean;
    remaining: number;
    label: string;
  };
  reportCards: {
    started: boolean;
    label: string;
  };
};

export function summarizeTeacherRecords(args: {
  enrolledCount: number;
  transitionSubmittedCount: number;
  transitionWorkflowStarted: boolean;
  reportingStarted: boolean;
  reportCompleteCount: number | null;
}): TeacherRecordsSummary {
  const enrolled = Math.max(0, args.enrolledCount);
  const submitted = Math.min(enrolled, Math.max(0, args.transitionSubmittedCount));
  const remaining = Math.max(0, enrolled - submitted);
  const transitionRelevant = args.transitionWorkflowStarted && enrolled > 0;
  const transitionLabel =
    remaining === 0 ? "Complete" : `${remaining} remaining`;

  let reportLabel = "Not started";
  if (args.reportingStarted && enrolled > 0 && args.reportCompleteCount != null) {
    const complete = Math.min(enrolled, Math.max(0, args.reportCompleteCount));
    const reportRemaining = Math.max(0, enrolled - complete);
    reportLabel =
      reportRemaining === 0
        ? `${complete} of ${enrolled} complete`
        : `${reportRemaining} remaining`;
  }

  const due =
    (transitionRelevant && remaining > 0) ||
    (args.reportingStarted &&
      enrolled > 0 &&
      args.reportCompleteCount != null &&
      args.reportCompleteCount < enrolled);

  return {
    due,
    emptyLabel: "Nothing due right now.",
    transition: {
      relevant: transitionRelevant,
      remaining,
      label: transitionLabel,
    },
    reportCards: {
      started: args.reportingStarted,
      label: reportLabel,
    },
  };
}

export function reportCardsQuickAccessSummary(args: {
  reportingStarted: boolean;
  enrolledCount: number;
  completeCount: number | null;
}): string {
  if (!args.reportingStarted || args.enrolledCount <= 0 || args.completeCount == null) {
    return "Not started";
  }
  const complete = Math.min(args.enrolledCount, Math.max(0, args.completeCount));
  if (complete >= args.enrolledCount) return `${complete} of ${args.enrolledCount} complete`;
  return `${args.enrolledCount - complete} remaining`;
}

export function attendanceQuickAccessSummary(args: {
  classesRequiringAttendance: number;
  classesNotSubmitted: number;
}): string {
  if (args.classesRequiringAttendance <= 0) return "No classes yet";
  if (args.classesNotSubmitted <= 0) return "Complete";
  if (args.classesNotSubmitted === 1) return "1 class remaining";
  return `${args.classesNotSubmitted} classes remaining`;
}

export function supportQuickAccessSummary(checkInCount: number): string {
  if (checkInCount <= 0) return "All clear";
  if (checkInCount === 1) return "1 student to review";
  return `${checkInCount} students to review`;
}

