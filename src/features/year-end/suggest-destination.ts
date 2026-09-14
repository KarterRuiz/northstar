import type { ClassRef } from "./types";

function normalizeSection(section: string | null | undefined): string {
  return (section ?? "").trim().toLowerCase();
}

/**
 * Suggest a destination class in the TO year for a source class + target grade.
 * Prefers same section within the target grade among active TO-year classes.
 */
export function suggestDestinationClass(args: {
  sourceClass: Pick<ClassRef, "section" | "name">;
  targetGradeLevelId: string | null;
  toYearClasses: readonly ClassRef[];
  toSchoolYearId: string;
}): ClassRef | null {
  if (!args.targetGradeLevelId) return null;

  const candidates = args.toYearClasses.filter(
    (c) =>
      c.school_year_id === args.toSchoolYearId &&
      c.is_active &&
      c.grade_level_id === args.targetGradeLevelId,
  );
  if (candidates.length === 0) return null;

  const sourceSection = normalizeSection(args.sourceClass.section);
  const bySection = candidates.filter(
    (c) => normalizeSection(c.section) === sourceSection,
  );
  if (bySection.length === 1) return bySection[0]!;
  if (bySection.length > 1) {
    // Prefer matching name when multiple share section.
    const sourceName = args.sourceClass.name.trim().toLowerCase();
    const byName = bySection.find(
      (c) => c.name.trim().toLowerCase() === sourceName,
    );
    return byName ?? bySection[0]!;
  }

  if (candidates.length === 1) return candidates[0]!;
  return null;
}

/**
 * Resolve mapped destination: explicit class map wins; else null (unassigned).
 */
export function resolveMappedDestinationClassId(
  fromClassId: string,
  classMaps: ReadonlyMap<string, string | null>,
): string | null | undefined {
  if (!classMaps.has(fromClassId)) return undefined;
  return classMaps.get(fromClassId) ?? null;
}
