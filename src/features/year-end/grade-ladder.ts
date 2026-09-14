import type { GradeLevelRef, YearEndDisposition } from "./types";

/**
 * Detect terminal Primary grade (typically Grade 5 / G5).
 * Prefer code G5, else name patterns, else highest non-archived sort_order
 * among grades that look like Grade N when only one candidate exists.
 */
export function isTerminalPrimaryGrade(grade: GradeLevelRef): boolean {
  const code = (grade.code ?? "").trim().toUpperCase();
  if (code === "G5") return true;

  const name = grade.name.trim();
  if (/^(grade|year|g)\s*5$/i.test(name)) return true;
  if (/^5$/.test(name)) return true;

  return false;
}

/** Next grade by ascending sort_order among non-archived levels (excluding terminal). */
export function findNextGradeLevel(
  current: GradeLevelRef,
  all: readonly GradeLevelRef[],
): GradeLevelRef | null {
  if (isTerminalPrimaryGrade(current)) return null;

  const live = all
    .filter((g) => !g.is_archived)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const higher = live.filter((g) => g.sort_order > current.sort_order);
  if (higher.length === 0) return null;

  // Prefer immediate next sort_order bucket.
  const minSort = higher[0]!.sort_order;
  const sameBucket = higher.filter((g) => g.sort_order === minSort);
  if (sameBucket.length === 1) return sameBucket[0]!;

  // Tie-break: prefer G{n+1} / Grade {n+1} when current looks numeric.
  const currentCode = (current.code ?? "").trim().toUpperCase();
  const currentNum = currentCode.match(/^G(\d+)$/i)?.[1];
  if (currentNum) {
    const want = `G${Number.parseInt(currentNum, 10) + 1}`;
    const byCode = sameBucket.find(
      (g) => (g.code ?? "").trim().toUpperCase() === want,
    );
    if (byCode) return byCode;
  }

  return sameBucket[0] ?? null;
}

/**
 * Default disposition for an operationally active student in the closing year.
 * G1–G4 (non-terminal) → promote; terminal Primary (G5) → graduate_primary.
 */
export function defaultDispositionForGrade(
  grade: GradeLevelRef | null | undefined,
): YearEndDisposition {
  if (!grade) return "promote";
  if (isTerminalPrimaryGrade(grade)) return "graduate_primary";
  return "promote";
}

/** Dispositions that place the student into a next-year class. */
export function dispositionRequiresDestination(
  disposition: YearEndDisposition,
): boolean {
  return (
    disposition === "promote" ||
    disposition === "retain" ||
    disposition === "remap" ||
    disposition === "custom"
  );
}

/** Dispositions that must not have a destination class for READY. */
export function dispositionForbidsDestination(
  disposition: YearEndDisposition,
): boolean {
  return (
    disposition === "graduate_primary" || disposition === "leave_school"
  );
}

export function dispositionRequiresReason(
  disposition: YearEndDisposition,
): boolean {
  return disposition === "custom";
}
