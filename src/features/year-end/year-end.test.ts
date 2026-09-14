import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canManageSchoolStructure } from "@/config/roles";
import {
  defaultDispositionForGrade,
  dispositionForbidsDestination,
  dispositionRequiresDestination,
  dispositionRequiresReason,
  findNextGradeLevel,
  isTerminalPrimaryGrade,
} from "@/features/year-end/grade-ladder";
import {
  buildDefaultPlanItems,
  mergePlanItemsOnRefresh,
} from "@/features/year-end/plan-items";
import {
  canMarkPlanReady,
  collectPreviewBlockers,
  summarizePreview,
  type PreviewItemInput,
} from "@/features/year-end/preview-validation";
import { suggestDestinationClass } from "@/features/year-end/suggest-destination";
import type { ClassRef, GradeLevelRef } from "@/features/year-end/types";

const grades: GradeLevelRef[] = [
  { id: "g1", name: "Grade 1", code: "G1", sort_order: 1, is_archived: false },
  { id: "g2", name: "Grade 2", code: "G2", sort_order: 2, is_archived: false },
  { id: "g3", name: "Grade 3", code: "G3", sort_order: 3, is_archived: false },
  { id: "g4", name: "Grade 4", code: "G4", sort_order: 4, is_archived: false },
  { id: "g5", name: "Grade 5", code: "G5", sort_order: 5, is_archived: false },
];

const fromG1A: ClassRef = {
  id: "c-from-g1a",
  school_year_id: "y-from",
  grade_level_id: "g1",
  name: "1A",
  section: "A",
  is_active: true,
};

const toG2A: ClassRef = {
  id: "c-to-g2a",
  school_year_id: "y-to",
  grade_level_id: "g2",
  name: "2A",
  section: "A",
  is_active: true,
};

const toG1A: ClassRef = {
  id: "c-to-g1a",
  school_year_id: "y-to",
  grade_level_id: "g1",
  name: "1A",
  section: "A",
  is_active: true,
};

function baseItem(
  overrides: Partial<PreviewItemInput> & Pick<PreviewItemInput, "id" | "studentId">,
): PreviewItemInput {
  return {
    studentNumber: "SN-001",
    disposition: "promote",
    reason: null,
    destinationClassId: toG2A.id,
    sourceEnrollmentId: "enr-1",
    ...overrides,
  };
}

describe("year-end Phase 1 pure logic", () => {
  it("A: draft defaults are safe (promote / graduate only — no placement mutation)", () => {
    const items = buildDefaultPlanItems({
      students: [
        {
          studentId: "s1",
          studentNumber: "1",
          sourceEnrollmentId: "e1",
          sourceClassId: fromG1A.id,
          sourceGradeLevelId: "g1",
        },
      ],
      gradesById: new Map(grades.map((g) => [g.id, g])),
      allGrades: grades,
      fromClassesById: new Map([[fromG1A.id, fromG1A]]),
      toYearClasses: [toG2A],
      toSchoolYearId: "y-to",
      classMaps: new Map(),
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]!.disposition, "promote");
    assert.equal(items[0]!.destinationClassId, toG2A.id);
  });

  it("B/C/N: preview validation never mutates enrollment identity fields (pure)", () => {
    const item = baseItem({ id: "i1", studentId: "s1" });
    const before = structuredClone(item);
    collectPreviewBlockers([item], {
      toSchoolYearId: "y-to",
      toYearClassesById: new Map([[toG2A.id, toG2A]]),
      studentsWithActiveToYearEnrollment: new Set(),
    });
    assert.deepEqual(item, before);
  });

  it("D: Grade 1 promotes to Grade 2 suggestion", () => {
    const next = findNextGradeLevel(grades[0]!, grades);
    assert.equal(next?.id, "g2");
    assert.equal(defaultDispositionForGrade(grades[0]!), "promote");
    const suggested = suggestDestinationClass({
      sourceClass: fromG1A,
      targetGradeLevelId: "g2",
      toYearClasses: [toG2A, toG1A],
      toSchoolYearId: "y-to",
    });
    assert.equal(suggested?.id, toG2A.id);
  });

  it("E: Grade 5 defaults to Graduate Primary", () => {
    assert.equal(isTerminalPrimaryGrade(grades[4]!), true);
    assert.equal(defaultDispositionForGrade(grades[4]!), "graduate_primary");
    assert.equal(findNextGradeLevel(grades[4]!, grades), null);
  });

  it("F: Retain keeps same grade but requires next-year class", () => {
    assert.equal(dispositionRequiresDestination("retain"), true);
    const blockers = collectPreviewBlockers(
      [
        baseItem({
          id: "i1",
          studentId: "s1",
          disposition: "retain",
          destinationClassId: null,
        }),
      ],
      {
        toSchoolYearId: "y-to",
        toYearClassesById: new Map([[toG1A.id, toG1A]]),
        studentsWithActiveToYearEnrollment: new Set(),
      },
    );
    assert.ok(blockers.some((b) => b.code === "missing_destination"));
  });

  it("G: Missing destination blocks READY", () => {
    const items = [
      baseItem({ id: "i1", studentId: "s1", destinationClassId: null }),
    ];
    const blockers = collectPreviewBlockers(items, {
      toSchoolYearId: "y-to",
      toYearClassesById: new Map([[toG2A.id, toG2A]]),
      studentsWithActiveToYearEnrollment: new Set(),
    });
    assert.equal(canMarkPlanReady(items, blockers), false);
    assert.ok(blockers.some((b) => b.code === "missing_destination"));
  });

  it("H: Missing Student Number blocks READY", () => {
    const items = [baseItem({ id: "i1", studentId: "s1", studentNumber: "  " })];
    const blockers = collectPreviewBlockers(items, {
      toSchoolYearId: "y-to",
      toYearClassesById: new Map([[toG2A.id, toG2A]]),
      studentsWithActiveToYearEnrollment: new Set(),
    });
    assert.ok(blockers.some((b) => b.code === "missing_student_number"));
    assert.equal(canMarkPlanReady(items, blockers), false);
  });

  it("I: Destination class from wrong school year blocks READY", () => {
    const wrongYear: ClassRef = { ...toG2A, id: "wrong", school_year_id: "y-other" };
    const items = [
      baseItem({ id: "i1", studentId: "s1", destinationClassId: wrongYear.id }),
    ];
    const blockers = collectPreviewBlockers(items, {
      toSchoolYearId: "y-to",
      toYearClassesById: new Map([[wrongYear.id, wrongYear]]),
      studentsWithActiveToYearEnrollment: new Set(),
    });
    assert.ok(blockers.some((b) => b.code === "wrong_year_destination"));
  });

  it("J: Existing target-year enrollment conflict blocks READY", () => {
    const items = [baseItem({ id: "i1", studentId: "s1" })];
    const blockers = collectPreviewBlockers(items, {
      toSchoolYearId: "y-to",
      toYearClassesById: new Map([[toG2A.id, toG2A]]),
      studentsWithActiveToYearEnrollment: new Set(["s1"]),
    });
    assert.ok(blockers.some((b) => b.code === "target_year_conflict"));
  });

  it("K: Reopening/re-running preview does not duplicate rows (merge)", () => {
    const fresh = buildDefaultPlanItems({
      students: [
        {
          studentId: "s1",
          studentNumber: "1",
          sourceEnrollmentId: "e1-new",
          sourceClassId: fromG1A.id,
          sourceGradeLevelId: "g1",
        },
        {
          studentId: "s2",
          studentNumber: "2",
          sourceEnrollmentId: "e2",
          sourceClassId: fromG1A.id,
          sourceGradeLevelId: "g1",
        },
      ],
      gradesById: new Map(grades.map((g) => [g.id, g])),
      allGrades: grades,
      fromClassesById: new Map([[fromG1A.id, fromG1A]]),
      toYearClasses: [toG2A],
      toSchoolYearId: "y-to",
      classMaps: new Map([[fromG1A.id, toG2A.id]]),
    });

    const merged = mergePlanItemsOnRefresh({
      existing: [
        {
          studentId: "s1",
          sourceEnrollmentId: "e1-old",
          disposition: "retain",
          destinationClassId: toG1A.id,
          destinationGradeLevelId: "g1",
          reason: "held by admin",
        },
      ],
      freshDefaults: fresh,
    });

    assert.equal(merged.length, 2);
    assert.equal(merged.filter((m) => m.studentId === "s1").length, 1);
    const s1 = merged.find((m) => m.studentId === "s1")!;
    assert.equal(s1.disposition, "retain");
    assert.equal(s1.destinationClassId, toG1A.id);
    assert.equal(s1.sourceEnrollmentId, "e1-new");
    assert.equal(merged.find((m) => m.studentId === "s2")!.disposition, "promote");
  });

  it("L: Class-copy/scaffold suggestion uses structure fields only (no student ids)", () => {
    const suggested = suggestDestinationClass({
      sourceClass: { name: "3B", section: "B" },
      targetGradeLevelId: "g2",
      toYearClasses: [toG2A],
      toSchoolYearId: "y-to",
    });
    // Section mismatch → null when multiple would be ambiguous; single candidate still ok
    assert.equal(suggested?.id, toG2A.id);
    assert.ok(!("studentId" in (suggested ?? {})));
  });

  it("M: Teacher cannot manage school structure / year-end", () => {
    assert.equal(canManageSchoolStructure("teacher"), false);
    assert.equal(canManageSchoolStructure("registrar"), false);
    assert.equal(canManageSchoolStructure("admin"), true);
    assert.equal(canManageSchoolStructure("principal"), true);
    assert.equal(canManageSchoolStructure("vice_principal"), true);
  });

  it("Custom requires reason; graduate/leave forbid destination", () => {
    assert.equal(dispositionRequiresReason("custom"), true);
    assert.equal(dispositionForbidsDestination("graduate_primary"), true);
    assert.equal(dispositionForbidsDestination("leave_school"), true);

    const blockers = collectPreviewBlockers(
      [
        baseItem({
          id: "i1",
          studentId: "s1",
          disposition: "custom",
          reason: null,
          destinationClassId: toG2A.id,
        }),
        baseItem({
          id: "i2",
          studentId: "s2",
          disposition: "graduate_primary",
          destinationClassId: toG2A.id,
        }),
      ],
      {
        toSchoolYearId: "y-to",
        toYearClassesById: new Map([[toG2A.id, toG2A]]),
        studentsWithActiveToYearEnrollment: new Set(),
      },
    );
    assert.ok(blockers.some((b) => b.code === "custom_reason_required"));
    assert.ok(blockers.some((b) => b.code === "destination_not_allowed"));
  });

  it("READY when all items valid", () => {
    const items = [
      baseItem({ id: "i1", studentId: "s1" }),
      baseItem({
        id: "i2",
        studentId: "s2",
        disposition: "graduate_primary",
        destinationClassId: null,
        studentNumber: "SN-002",
      }),
    ];
    const blockers = collectPreviewBlockers(items, {
      toSchoolYearId: "y-to",
      toYearClassesById: new Map([[toG2A.id, toG2A]]),
      studentsWithActiveToYearEnrollment: new Set(),
    });
    assert.equal(blockers.length, 0);
    assert.equal(canMarkPlanReady(items, blockers), true);
    const counts = summarizePreview(items, blockers);
    assert.equal(counts.promote, 1);
    assert.equal(counts.graduate_primary, 1);
  });

  it("Class map destination preferred over auto-suggest", () => {
    const items = buildDefaultPlanItems({
      students: [
        {
          studentId: "s1",
          studentNumber: "1",
          sourceEnrollmentId: "e1",
          sourceClassId: fromG1A.id,
          sourceGradeLevelId: "g1",
        },
      ],
      gradesById: new Map(grades.map((g) => [g.id, g])),
      allGrades: grades,
      fromClassesById: new Map([[fromG1A.id, fromG1A]]),
      toYearClasses: [toG2A, toG1A],
      toSchoolYearId: "y-to",
      classMaps: new Map([[fromG1A.id, toG1A.id]]),
    });
    assert.equal(items[0]!.destinationClassId, toG1A.id);
  });
});
