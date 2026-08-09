/** Compact class list for directory cells: `5A · 5B · 5D` or `3 classes`. */
export function formatStaffAssignedClassesSummary(
  assigned: { section: string | null; className: string }[],
): string {
  if (assigned.length === 0) return "No classes";
  const shorts = assigned.map((a) => {
    const section = a.section?.trim();
    if (section) return section;
    return a.className.trim() || "Class";
  });
  const joined = shorts.join(" · ");
  if (shorts.length <= 3 && joined.length <= 28) return joined;
  return `${assigned.length} classes`;
}
