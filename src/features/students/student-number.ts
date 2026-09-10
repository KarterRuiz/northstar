/**
 * Student identity — do not merge these concepts:
 *
 * 1. `students.id` — internal permanent UUID (Northstar Record ID). Never show as "Student ID".
 * 2. `students.external_id` — SCHOOL STUDENT NUMBER (human/school-facing, unique, portable).
 *    Required for all new students. Trimmed on write; leading zeros preserved; not auto-generated.
 * 3. `student_enrollments.roster_number` — class-scoped roster order only.
 *
 * No foreign_sis_id column unless a future SIS integration absolutely requires it.
 */

export const STUDENT_NUMBER_MAX = 64;

export const STUDENT_NUMBER_REQUIRED_MESSAGE = "Student Number is required.";
export const STUDENT_NUMBER_DUPLICATE_MESSAGE =
  "A student with this Student Number already exists.";
export const STUDENT_NUMBER_TOO_LONG_MESSAGE = `Student Number must be at most ${STUDENT_NUMBER_MAX} characters.`;

/**
 * Parse a Student Number from user/import input.
 * Trims edges only (preserves leading zeros). Rejects blank / whitespace-only.
 */
export function parseStudentNumber(
  raw: string | null | undefined,
):
  | { ok: true; value: string }
  | { ok: false; message: string } {
  const t = (raw ?? "").trim();
  if (!t) {
    return { ok: false, message: STUDENT_NUMBER_REQUIRED_MESSAGE };
  }
  if (t.length > STUDENT_NUMBER_MAX) {
    return { ok: false, message: STUDENT_NUMBER_TOO_LONG_MESSAGE };
  }
  return { ok: true, value: t };
}

/** Display helper: empty / em dash → "Not assigned" for legacy rows. */
export function formatStudentNumberDisplay(
  value: string | null | undefined,
): string {
  const t = (value ?? "").trim();
  if (!t || t === "—") return "Not assigned";
  return t;
}

export function isStudentNumberAssigned(
  value: string | null | undefined,
): boolean {
  const t = (value ?? "").trim();
  return Boolean(t) && t !== "—";
}

/**
 * Match key for in-batch / against-system duplicate checks.
 * Lowercases for soft match only — stored value remains exact trimmed string.
 */
export function studentNumberMatchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isStudentNumberUniqueViolation(
  message: string | null | undefined,
  code?: string | null,
): boolean {
  if (code === "23505") return true;
  const m = message ?? "";
  return (
    m.includes("students_external_id_unique") ||
    m.includes("students_external_id_key")
  );
}
