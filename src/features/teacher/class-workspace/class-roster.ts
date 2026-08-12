import { canManageClassEnrollment, type Role } from "@/config/roles";
import type { TeacherCheckInReason } from "@/features/teacher/dashboard/teacher-home-summaries";

/**
 * Teacher-facing name — same rule as Student Profile, directory, Home, and Overview:
 * preferred name when present, otherwise first + last.
 */
export function teacherStudentDisplayName(row: {
  preferredName: string | null | undefined;
  firstName: string;
  lastName: string;
}): string {
  const pref = row.preferredName?.trim();
  if (pref) return pref;
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || "—";
}

export function classRosterSearchText(row: {
  displayName: string;
  firstName: string;
  lastName: string;
  preferredName: string | null | undefined;
  studentNumber: string | null | undefined;
}): string {
  return [
    row.displayName,
    row.firstName,
    row.lastName,
    row.preferredName ?? "",
    row.studentNumber ?? "",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function matchesClassRosterSearch(searchText: string, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  return searchText.includes(q);
}

/** Restrained roster status — never expose check-in reason codes or thresholds. */
export function rosterSupportLabel(reason: TeacherCheckInReason | null): string {
  return reason ? "Follow-up" : "—";
}

/**
 * Per-student records completion belongs on the Records tab detail lists —
 * not on every roster row. Kept here only for focused unit coverage of the
 * former quiet-summary rules used by Records helpers.
 */
export type RosterRecordsSummary = {
  label: string;
  remaining: number;
  relevant: boolean;
};

export function summarizeRosterStudentRecords(args: {
  transitionRelevant: boolean;
  transitionSubmitted: boolean;
  reportingRelevant: boolean;
  reportComplete: boolean;
}): RosterRecordsSummary {
  const relevantCount =
    Number(args.transitionRelevant) + Number(args.reportingRelevant);
  if (relevantCount === 0) {
    return { label: "—", remaining: 0, relevant: false };
  }

  const remaining =
    Number(args.transitionRelevant && !args.transitionSubmitted) +
    Number(args.reportingRelevant && !args.reportComplete);

  if (remaining === 0) {
    return { label: "Up to date", remaining: 0, relevant: true };
  }
  if (remaining === relevantCount) {
    return { label: "Not started", remaining, relevant: true };
  }
  return {
    label: remaining === 1 ? "1 remaining" : `${remaining} remaining`,
    remaining,
    relevant: true,
  };
}

export type ClassRosterFilter = "all" | "support";

export const CLASS_ROSTER_FILTERS: { id: ClassRosterFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "support", label: "Needs support" },
];

export type ClassRosterFilterable = {
  searchText: string;
  needsSupport: boolean;
};

export function filterClassRoster<T extends ClassRosterFilterable>(
  students: T[],
  args: { query: string; filter: ClassRosterFilter },
): T[] {
  return students.filter((row) => {
    if (!matchesClassRosterSearch(row.searchText, args.query)) return false;
    if (args.filter === "support" && !row.needsSupport) return false;
    return true;
  });
}

export function classRosterHasStudentNumbers(
  students: { studentNumber: string | null }[],
): boolean {
  return students.some((row) => Boolean(row.studentNumber?.trim()));
}

export function classRosterFiltersUseful(
  students: { needsSupport: boolean }[],
): boolean {
  return students.some((row) => row.needsSupport);
}

export function classRosterEnrollmentVisible(role: Role): boolean {
  return canManageClassEnrollment(role);
}
