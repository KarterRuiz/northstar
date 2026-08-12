import type { TeacherCheckInReason } from "@/features/teacher/dashboard/teacher-home-summaries";

/**
 * Class Support is a check-in list, not an analytics dashboard.
 * Categories match filters the teacher can actually use.
 */
export const CLASS_SUPPORT_CATEGORIES = [
  "academic",
  "attendance",
  "support",
  "follow_up",
] as const;

export type ClassSupportCategory = (typeof CLASS_SUPPORT_CATEGORIES)[number];

export type ClassSupportFilter = "all" | ClassSupportCategory;

export const CLASS_SUPPORT_CATEGORY_LABEL: Record<ClassSupportCategory, string> = {
  academic: "Academic",
  attendance: "Attendance",
  support: "Support",
  follow_up: "Follow-Up",
};

export const CLASS_SUPPORT_FILTERS: { id: ClassSupportFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "academic", label: "Academic" },
  { id: "attendance", label: "Attendance" },
  { id: "support", label: "Support" },
  { id: "follow_up", label: "Follow-Up" },
];

export function checkInCategoryForReason(
  reason: TeacherCheckInReason,
): ClassSupportCategory {
  if (reason === "attendance") return "attendance";
  if (reason === "missing_work" || reason === "academic") return "academic";
  if (reason === "follow_up") return "follow_up";
  return "support";
}

export function checkInCategoriesFromFlags(flags: {
  attendanceConcern: boolean;
  missingWork: boolean;
  academicRisk: boolean;
  behaviorConcern: boolean;
  followUpDue: boolean;
  openPlan: boolean;
}): ClassSupportCategory[] {
  const categories: ClassSupportCategory[] = [];
  if (flags.missingWork || flags.academicRisk) categories.push("academic");
  if (flags.attendanceConcern) categories.push("attendance");
  if (flags.behaviorConcern || flags.openPlan) categories.push("support");
  if (flags.followUpDue) categories.push("follow_up");
  return categories;
}

export function checkInSummaryLabel(count: number): string {
  if (count <= 0) return "No students need follow-up right now.";
  if (count === 1) return "1 student to check in on";
  return `${count} students to check in on`;
}

export type ClassSupportFilterable = {
  categories: ClassSupportCategory[];
};

export function filterClassSupport<T extends ClassSupportFilterable>(
  students: T[],
  filter: ClassSupportFilter,
): T[] {
  if (filter === "all") return students;
  return students.filter((row) => row.categories.includes(filter));
}

/** Filters that have at least one student — omit empty buckets. */
export function classSupportFiltersPresent(
  students: ClassSupportFilterable[],
): ClassSupportFilter[] {
  const present = new Set<ClassSupportCategory>();
  for (const row of students) {
    for (const category of row.categories) present.add(category);
  }
  const filters: ClassSupportFilter[] = ["all"];
  for (const id of CLASS_SUPPORT_CATEGORIES) {
    if (present.has(id)) filters.push(id);
  }
  return filters;
}

export function classSupportFiltersUseful(
  students: ClassSupportFilterable[],
): boolean {
  return classSupportFiltersPresent(students).length > 2;
}
