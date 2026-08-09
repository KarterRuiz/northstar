/**
 * Primary tab order for the student profile shell (school command center).
 * Deep links: `/grades` and `/files` redirect to `academics` and `documents`.
 * `/growth` remains available; breadcrumbs link back from Growth.
 */
export const STUDENT_PROFILE_TAB_IDS = [
  "overview",
  "academics",
  "attendance",
  "behavior",
  "interventions",
  "parent-communication",
  "documents",
  "report-cards",
  "transition-notes",
  "audit-history",
] as const;

export type StudentProfileTabId = (typeof STUDENT_PROFILE_TAB_IDS)[number];

/** URL segment aliases → canonical tab id (for tab highlight on legacy routes). */
export const STUDENT_PROFILE_TAB_SEGMENT_ALIASES: Record<string, StudentProfileTabId> =
  {
    grades: "academics",
    files: "documents",
    growth: "academics",
  };

export function isStudentProfileTabId(
  value: string,
): value is StudentProfileTabId {
  return (STUDENT_PROFILE_TAB_IDS as readonly string[]).includes(value);
}
