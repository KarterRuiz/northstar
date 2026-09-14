import {
  bumpClassNameForNextGrade,
  gradeNumberFromLevel,
  inferProgramFromText,
  parseClassLineage,
} from "./class-lineage";
import type { ClassRef, GradeLevelRef } from "./types";

function normalizeSection(section: string | null | undefined): string {
  return (section ?? "").trim().toLowerCase();
}

/**
 * Suggest a destination class in the TO year for a source class + target grade.
 * Prefers lineage name / section within the same program stream.
 * Does not fall back to "only candidate in grade" (that caused multi-source → one dest).
 */
export function suggestDestinationClass(args: {
  sourceClass: Pick<ClassRef, "section" | "name">;
  targetGradeLevelId: string | null;
  toYearClasses: readonly ClassRef[];
  toSchoolYearId: string;
  sourceGrade?: GradeLevelRef | null;
  targetGrade?: GradeLevelRef | null;
}): ClassRef | null {
  if (!args.targetGradeLevelId) return null;

  const sourceProgram = inferProgramFromText(
    args.sourceClass.name,
    args.sourceClass.section,
    args.sourceGrade?.name,
  );
  const sourceLin = parseClassLineage(args.sourceClass, args.sourceGrade?.name);

  const candidates = args.toYearClasses.filter((c) => {
    if (c.school_year_id !== args.toSchoolYearId) return false;
    if (!c.is_active) return false;
    if (c.grade_level_id !== args.targetGradeLevelId) return false;
    const destProgram = inferProgramFromText(
      c.name,
      c.section,
      args.targetGrade?.name,
    );
    if (sourceProgram !== "unknown" && destProgram !== "unknown") {
      return destProgram === sourceProgram;
    }
    return true;
  });
  if (candidates.length === 0) return null;

  const fromNum = args.sourceGrade ? gradeNumberFromLevel(args.sourceGrade) : null;
  const toNum = args.targetGrade ? gradeNumberFromLevel(args.targetGrade) : null;
  const wantName =
    toNum != null
      ? bumpClassNameForNextGrade(args.sourceClass.name, fromNum, toNum).name
      : args.sourceClass.name;
  const wantNameKey = wantName.trim().toLowerCase();

  const byWantedName = candidates.filter(
    (c) => c.name.trim().toLowerCase() === wantNameKey,
  );
  if (byWantedName.length === 1) return byWantedName[0]!;
  if (byWantedName.length > 1) {
    const sourceSection = normalizeSection(args.sourceClass.section);
    const bySec = byWantedName.find(
      (c) => normalizeSection(c.section) === sourceSection,
    );
    return bySec ?? byWantedName[0]!;
  }

  if (sourceLin.sectionToken) {
    const byLineage = candidates.filter((c) => {
      const destLin = parseClassLineage(c, args.targetGrade?.name);
      return (
        destLin.sectionToken != null &&
        destLin.sectionToken === sourceLin.sectionToken
      );
    });
    if (byLineage.length === 1) return byLineage[0]!;
  }

  const sourceSection = normalizeSection(args.sourceClass.section);
  if (sourceSection) {
    const bySection = candidates.filter(
      (c) => normalizeSection(c.section) === sourceSection,
    );
    if (bySection.length === 1) return bySection[0]!;
    if (bySection.length > 1) {
      const sourceName = args.sourceClass.name.trim().toLowerCase();
      const byName = bySection.find(
        (c) => c.name.trim().toLowerCase() === sourceName,
      );
      return byName ?? null;
    }
  }

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
