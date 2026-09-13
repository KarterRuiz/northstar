/**
 * Pure school-year integrity helpers (no I/O).
 * Canonical operational SoT remains `school_years.is_current` via
 * `loadCurrentSchoolYear` / `getCurrentSchoolYear`.
 */

/** When a current year is designated, only that year's classes belong on Today. */
export function classBelongsToCurrentYear(
  classYearId: string | null,
  currentYearId: string | null,
): boolean {
  if (!currentYearId) return true;
  if (!classYearId) return false;
  return classYearId === currentYearId;
}

/** Enrollment year must equal the related class year. */
export function enrollmentSchoolYearMatchesClass(
  enrollmentSchoolYearId: string | null | undefined,
  classSchoolYearId: string | null | undefined,
): boolean {
  const e = enrollmentSchoolYearId?.trim() ?? "";
  const c = classSchoolYearId?.trim() ?? "";
  if (!e || !c) return false;
  return e === c;
}

/**
 * Default school-year label for operational filters.
 * Prefer an explicit request, then `is_current` label, then first listed option
 * (callers should order options with current first or by starts_on DESC).
 */
export function pickDefaultSchoolYearLabel(args: {
  yearLabels: readonly string[];
  currentLabel?: string | null;
  requested?: string | null;
}): string {
  const labels = args.yearLabels.map((l) => l.trim()).filter(Boolean);
  const requested = args.requested?.trim() || "";
  if (requested && labels.includes(requested)) return requested;

  const current = args.currentLabel?.trim() || "";
  if (current && labels.includes(current)) return current;

  return labels[0] ?? current;
}

export const CLASS_SCHOOL_YEAR_LOCKED_MESSAGE =
  "This class already has enrollment history. School year cannot be changed.";

/** Block rewriting class year once any enrollment exists for the class. */
export function classSchoolYearChangeBlocked(args: {
  previousSchoolYearId: string;
  nextSchoolYearId: string;
  enrollmentCount: number;
}): boolean {
  if (args.previousSchoolYearId === args.nextSchoolYearId) return false;
  return args.enrollmentCount > 0;
}

/**
 * Changing `school_years.is_current` must not rewrite historical row FKs / text labels.
 * Pure documentation of expected behavior for tests.
 */
export function currentYearFlagChangeMutatesHistory(): boolean {
  return false;
}
