/**
 * Pure school-year integrity helpers (no I/O).
 * Canonical operational SoT remains `school_years.is_current` via
 * `loadCurrentSchoolYear` / `getCurrentSchoolYear`.
 */

/**
 * Canonical text label for NEW attendance / behavior / report_card_files writes.
 * Always copy exact `school_years.label` for the related year row — never invent
 * a hyphen/dash variant in feature code.
 *
 * Archived dash-variant issue: live history can contain both ASCII hyphen
 * (`2025-2026`) and Unicode en dash (`2025–2026`) on archived duplicate year
 * rows, and text columns already store whichever label was used at write time.
 * Do NOT rewrite historical text labels to unify them; filter/read against the
 * stored string. New writes must use this helper on the related year's label.
 */
export function canonicalSchoolYearLabel(
  year: { label: string } | string | null | undefined,
): string | null {
  if (year == null) return null;
  const raw = typeof year === "string" ? year : year.label;
  const trimmed = raw?.trim() ?? "";
  return trimmed || null;
}

/**
 * School year for NEW transition notes.
 *
 * Choice: prefer an active enrollment whose year matches the designated current
 * year; else the first active enrollment year (sorted for determinism); else the
 * current school year id. Historical null `school_year_id` rows are left alone.
 */
export function resolveTransitionNoteSchoolYearId(args: {
  currentYearId: string | null;
  activeEnrollmentYearIds: readonly string[];
}): string | null {
  const current = args.currentYearId?.trim() || null;
  const enrollmentIds = [
    ...new Set(
      args.activeEnrollmentYearIds
        .map((id) => id?.trim() || "")
        .filter(Boolean),
    ),
  ].sort();

  if (current && enrollmentIds.includes(current)) return current;
  if (enrollmentIds[0]) return enrollmentIds[0];
  return current;
}

/** Standard report-card / gradebook term codes expected per school year. */
export const STANDARD_TERM_CODES = ["T1", "T2", "T3", "T4"] as const;

export type StandardTermCode = (typeof STANDARD_TERM_CODES)[number];

export function standardTermName(code: StandardTermCode): string {
  return `Term ${code.slice(1)}`;
}

/** Codes still missing for a year (T1–T4 expectation). */
export function missingStandardTermCodes(
  existingCodes: readonly string[],
): StandardTermCode[] {
  const have = new Set(
    existingCodes.map((c) => c.trim().toUpperCase()).filter(Boolean),
  );
  return STANDARD_TERM_CODES.filter((code) => !have.has(code));
}

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
