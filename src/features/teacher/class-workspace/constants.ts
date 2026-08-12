export const CLASS_WORKSPACE_TAB_IDS = [
  "overview",
  "students",
  "attendance",
  "gradebook",
  "support",
  "records",
] as const;

export type ClassWorkspaceTabId = (typeof CLASS_WORKSPACE_TAB_IDS)[number];

export const CLASS_WORKSPACE_TAB_LABELS: Record<ClassWorkspaceTabId, string> = {
  overview: "Overview",
  students: "Students",
  attendance: "Attendance",
  gradebook: "Gradebook",
  support: "Support",
  records: "Records",
};

const TAB_ID_SET = new Set<string>(CLASS_WORKSPACE_TAB_IDS);

export function isClassWorkspaceTabId(value: string): value is ClassWorkspaceTabId {
  return TAB_ID_SET.has(value);
}

export function classWorkspacePath(classId: string, tab: ClassWorkspaceTabId = "overview"): string {
  return `/dashboard/teacher/classes/${classId}/${tab}`;
}

export function classWorkspaceAttendanceHref(classId: string): string {
  return classWorkspacePath(classId, "attendance");
}

export function classWorkspaceGradebookHref(classId: string): string {
  return classWorkspacePath(classId, "gradebook");
}

export function classWorkspaceGradebookPickerHref(): string {
  return "/dashboard/teacher/gradebook";
}

export function classWorkspaceSupportHref(): string {
  return "/dashboard/teacher/interventions";
}

/** Existing student support / interventions tab — Support rows open here. */
export function classWorkspaceStudentInterventionsHref(studentId: string): string {
  return `/dashboard/teacher/students/${studentId}/interventions`;
}

export function classWorkspaceReportCardsHref(classId?: string): string {
  if (classId) {
    return `/dashboard/teacher/report-cards?classId=${encodeURIComponent(classId)}`;
  }
  return "/dashboard/teacher/report-cards";
}

export function classWorkspaceTransitionNotesHref(): string {
  return "/dashboard/teacher/transition-notes";
}

/** Nested Records detail — report cards or transition notes completion list. */
export function classWorkspaceRecordsViewHref(
  classId: string,
  view: "report-cards" | "transition-notes",
): string {
  return `${classWorkspacePath(classId, "records")}?view=${view}`;
}

/** Existing Student Profile — roster rows navigate here, never a second profile. */
export function classWorkspaceStudentProfileHref(studentId: string): string {
  return `/dashboard/teacher/students/${studentId}/overview`;
}

/** Existing student report-card tab — Records detail actions open here. */
export function classWorkspaceStudentReportCardsHref(studentId: string): string {
  return `/dashboard/teacher/students/${studentId}/report-cards`;
}

/** Existing transition-note composer for one student. */
export function classWorkspaceStudentTransitionNoteHref(studentId: string): string {
  return `/dashboard/teacher/transition-notes/new?studentId=${encodeURIComponent(studentId)}`;
}

export const CLASS_WORKSPACE_CHECK_IN_LIMIT = 5;
