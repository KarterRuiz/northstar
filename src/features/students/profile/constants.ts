export const STUDENT_PROFILE_TAB_IDS = [
  "overview",
  "grades",
  "attendance",
  "behavior",
  "transition-notes",
  "report-cards",
  "growth",
  "interventions",
  "files",
  "audit-history",
] as const;

export type StudentProfileTabId = (typeof STUDENT_PROFILE_TAB_IDS)[number];

export function isStudentProfileTabId(
  value: string,
): value is StudentProfileTabId {
  return (STUDENT_PROFILE_TAB_IDS as readonly string[]).includes(value);
}
