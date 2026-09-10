/**
 * Class-scoped roster ordering helpers.
 *
 * Identity (do not merge):
 * - `students.id` — Northstar Record ID (internal UUID)
 * - `students.external_id` (UI: Student Number) — school-wide permanent identifier
 * - `student_enrollments.roster_number` (UI: Roster #) — class + year position only
 */

export function parseRosterNumberInput(raw: string): {
  ok: true;
  value: number | null;
} | {
  ok: false;
  message: string;
} {
  const t = raw.trim();
  if (!t) return { ok: true, value: null };
  if (!/^\d+$/.test(t)) {
    return {
      ok: false,
      message: "Roster # must be a whole number (for example 1, 2, 3).",
    };
  }
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) {
    return {
      ok: false,
      message: "Roster # must be a positive whole number.",
    };
  }
  if (n > 9999) {
    return {
      ok: false,
      message: "Roster # must be at most 9999.",
    };
  }
  return { ok: true, value: n };
}

/** Numeric roster sort: numbered students first, then name secondary. */
export function compareRosterOrder(
  a: { rosterNumber: number | null; displayName: string },
  b: { rosterNumber: number | null; displayName: string },
): number {
  const aNum = a.rosterNumber;
  const bNum = b.rosterNumber;
  if (aNum != null && bNum != null && aNum !== bNum) {
    return aNum - bNum;
  }
  if (aNum != null && bNum == null) return -1;
  if (aNum == null && bNum != null) return 1;
  return a.displayName.localeCompare(b.displayName, undefined, {
    sensitivity: "base",
  });
}

export function createBulkAddRowKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
