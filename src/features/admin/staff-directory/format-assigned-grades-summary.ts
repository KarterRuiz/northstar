/** Compact grade list for directory cells. */
export function formatStaffAssignedGradesSummary(
  grades: { gradeName: string }[],
): string {
  if (grades.length === 0) return "No grades";
  const names = grades.map((g) => g.gradeName.trim()).filter(Boolean);
  const joined = names.join(" · ");
  if (names.length <= 3 && joined.length <= 32) return joined;
  return `${grades.length} grades`;
}
