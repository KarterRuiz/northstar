/** Shared school-year resolution for admin attendance loaders. */

export function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type ClassWithSchoolYear = {
  school_years: { label: string } | { label: string }[] | null;
};

/** Labels from filtered classes plus the active filter / term fallback (for `.in("school_year", …)`). */
export function schoolYearLabelsForFilteredClasses(
  classes: ClassWithSchoolYear[],
  selectedSchoolYear: string,
  fallbackSchoolYear: string,
): string[] {
  const labels = new Set<string>();
  for (const c of classes) {
    const label = unwrapOne(c.school_years)?.label?.trim();
    if (label) labels.add(label);
  }
  const selected = selectedSchoolYear.trim();
  if (selected) labels.add(selected);
  const fallback = fallbackSchoolYear.trim();
  if (fallback) labels.add(fallback);
  return [...labels];
}
