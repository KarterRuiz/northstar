import {
  defaultDispositionForGrade,
  findNextGradeLevel,
  isTerminalPrimaryGrade,
} from "./grade-ladder";
import { suggestDestinationClass } from "./suggest-destination";
import type { ClassRef, GradeLevelRef, YearEndDisposition } from "./types";

export type EligibleStudentInput = {
  studentId: string;
  studentNumber: string | null;
  sourceEnrollmentId: string;
  sourceClassId: string;
  sourceGradeLevelId: string;
};

export type DraftPlanItem = {
  studentId: string;
  sourceEnrollmentId: string;
  disposition: YearEndDisposition;
  destinationClassId: string | null;
  destinationGradeLevelId: string | null;
  reason: string | null;
};

/**
 * Build default draft items for operationally active students.
 * Uses class map when present; otherwise suggests by next grade + section.
 */
export function buildDefaultPlanItems(args: {
  students: readonly EligibleStudentInput[];
  gradesById: ReadonlyMap<string, GradeLevelRef>;
  allGrades: readonly GradeLevelRef[];
  fromClassesById: ReadonlyMap<string, ClassRef>;
  toYearClasses: readonly ClassRef[];
  toSchoolYearId: string;
  /** from_class_id → to_class_id (null = explicitly unmapped). */
  classMaps: ReadonlyMap<string, string | null>;
}): DraftPlanItem[] {
  const {
    students,
    gradesById,
    allGrades,
    fromClassesById,
    toYearClasses,
    toSchoolYearId,
    classMaps,
  } = args;

  return students.map((s) => {
    const grade = gradesById.get(s.sourceGradeLevelId) ?? null;
    const disposition = defaultDispositionForGrade(grade ?? undefined);
    const sourceClass = fromClassesById.get(s.sourceClassId);

    if (disposition === "graduate_primary" || (grade && isTerminalPrimaryGrade(grade))) {
      return {
        studentId: s.studentId,
        sourceEnrollmentId: s.sourceEnrollmentId,
        disposition: "graduate_primary",
        destinationClassId: null,
        destinationGradeLevelId: null,
        reason: null,
      };
    }

    let destinationClassId: string | null = null;
    let destinationGradeLevelId: string | null = null;

    if (classMaps.has(s.sourceClassId)) {
      const mapped = classMaps.get(s.sourceClassId) ?? null;
      destinationClassId = mapped;
      if (mapped) {
        const dest = toYearClasses.find((c) => c.id === mapped);
        destinationGradeLevelId = dest?.grade_level_id ?? null;
      }
    } else if (sourceClass && grade) {
      const nextGrade = findNextGradeLevel(grade, allGrades);
      destinationGradeLevelId = nextGrade?.id ?? null;
      const suggested = suggestDestinationClass({
        sourceClass,
        targetGradeLevelId: destinationGradeLevelId,
        toYearClasses,
        toSchoolYearId,
      });
      destinationClassId = suggested?.id ?? null;
    }

    return {
      studentId: s.studentId,
      sourceEnrollmentId: s.sourceEnrollmentId,
      disposition,
      destinationClassId,
      destinationGradeLevelId,
      reason: null,
    };
  });
}

/** Merge refresh: keep existing overrides; add new students; drop departed. */
export function mergePlanItemsOnRefresh(args: {
  existing: ReadonlyArray<{
    studentId: string;
    sourceEnrollmentId: string;
    disposition: YearEndDisposition;
    destinationClassId: string | null;
    destinationGradeLevelId: string | null;
    reason: string | null;
  }>;
  freshDefaults: readonly DraftPlanItem[];
}): DraftPlanItem[] {
  const existingByStudent = new Map(
    args.existing.map((row) => [row.studentId, row] as const),
  );
  const result: DraftPlanItem[] = [];

  for (const fresh of args.freshDefaults) {
    const prev = existingByStudent.get(fresh.studentId);
    if (prev) {
      result.push({
        studentId: prev.studentId,
        sourceEnrollmentId: fresh.sourceEnrollmentId,
        disposition: prev.disposition,
        destinationClassId: prev.destinationClassId,
        destinationGradeLevelId: prev.destinationGradeLevelId,
        reason: prev.reason,
      });
    } else {
      result.push(fresh);
    }
  }

  return result;
}
