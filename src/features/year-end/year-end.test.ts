import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canManageSchoolStructure } from "@/config/roles";
import {
  classStructureKey,
  collectIntentionalMerges,
  proposeNextGradeShells,
  suggestLineageClassMaps,
  suggestNextShellInBucket,
  summarizeCohortCapacity,
} from "@/features/year-end/class-lineage";
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
    const matching: ClassRef = {
      ...toG2A,
      id: "c-to-g2b",
      name: "2B",
      section: "B",
    };
    const suggested = suggestDestinationClass({
      sourceClass: { name: "1B", section: "B" },
      targetGradeLevelId: "g2",
      toYearClasses: [toG2A, matching],
      toSchoolYearId: "y-to",
      sourceGrade: grades[0],
      targetGrade: grades[1],
    });
    assert.equal(suggested?.id, matching.id);
    assert.ok(!("studentId" in (suggested ?? {})));
  });

  it("L2: Does not collapse multiple sources onto sole dest candidate", () => {
    const suggested = suggestDestinationClass({
      sourceClass: { name: "ECG1-5", section: "5" },
      targetGradeLevelId: "g2",
      toYearClasses: [toG2A],
      toSchoolYearId: "y-to",
      sourceGrade: grades[0],
      targetGrade: grades[1],
    });
    assert.equal(suggested, null);
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

describe("year-end cohort scaffold + capacity (Phase class scaffolding)", () => {
  const gradesWithPrograms: GradeLevelRef[] = [
    ...grades,
    {
      id: "eg1",
      name: "Experimental Grade 1",
      code: "EG1",
      sort_order: 1,
      is_archived: false,
    },
    {
      id: "eg2",
      name: "Experimental Grade 2",
      code: "EG2",
      sort_order: 2,
      is_archived: false,
    },
    {
      id: "ig3",
      name: "International Grade 3",
      code: "IG3",
      sort_order: 3,
      is_archived: false,
    },
    {
      id: "ig4",
      name: "International Grade 4",
      code: "IG4",
      sort_order: 4,
      is_archived: false,
    },
  ];
  const gradesById = new Map(gradesWithPrograms.map((g) => [g.id, g]));

  function ecg(id: string, gradeId: string, name: string, section: string): ClassRef {
    return {
      id,
      school_year_id: "y-from",
      grade_level_id: gradeId,
      name,
      section,
      is_active: true,
    };
  }

  it("A: ECG1-1..5 propose ECG2-1..5 regardless of existing G2 count", () => {
    const sources = [1, 2, 3, 4, 5].map((n) =>
      ecg(`s${n}`, "eg1", `ECG1-${n}`, String(n)),
    );
    const existingG2 = [ecg("d1", "eg2", "ECG2-1", "1"), ecg("d2", "eg2", "ECG2-2", "2")].map(
      (c) => ({ ...c, school_year_id: "y-to" }),
    );
    void existingG2;
    const proposals = proposeNextGradeShells({
      sourceClasses: sources,
      gradesById,
      allGrades: gradesWithPrograms,
    }).filter((p) => !p.skippedReason);
    assert.equal(proposals.length, 5);
    assert.deepEqual(
      proposals.map((p) => p.name).sort(),
      ["ECG2-1", "ECG2-2", "ECG2-3", "ECG2-4", "ECG2-5"],
    );
    assert.ok(proposals.every((p) => p.targetGradeLevelId === "eg2"));
  });

  it("B: International 3A/3B → International 4A/4B", () => {
    const sources = [
      ecg("i3a", "ig3", "International 3A", "A"),
      ecg("i3b", "ig3", "International 3B", "B"),
    ];
    const proposals = proposeNextGradeShells({
      sourceClasses: sources,
      gradesById,
      allGrades: gradesWithPrograms,
    }).filter((p) => !p.skippedReason);
    assert.deepEqual(
      proposals.map((p) => p.name).sort(),
      ["International 4A", "International 4B"],
    );
    assert.ok(proposals.every((p) => p.targetGradeLevelId === "ig4"));
  });

  it("C: Grade 5 does not scaffold Grade 6 Primary", () => {
    const sources = [ecg("g5a", "g5", "5A", "A")];
    const proposals = proposeNextGradeShells({
      sourceClasses: sources,
      gradesById,
      allGrades: gradesWithPrograms,
    });
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]!.skippedReason, "terminal_grade");
  });

  it("D: Experimental stays Experimental (no cross-stream rename)", () => {
    const sources = [ecg("e1", "eg1", "ECG1-1", "1")];
    const proposals = proposeNextGradeShells({
      sourceClasses: sources,
      gradesById,
      allGrades: gradesWithPrograms,
    });
    assert.equal(proposals[0]!.program, "experimental");
    assert.equal(proposals[0]!.name, "ECG2-1");
    assert.equal(proposals[0]!.targetGradeLevelId, "eg2");
    assert.notEqual(proposals[0]!.targetGradeLevelId, "g2");
  });

  it("E: Capacity check reports deficit when shells short", () => {
    const sources = [1, 2, 3, 4, 5].map((n) =>
      ecg(`s${n}`, "eg1", `ECG1-${n}`, String(n)),
    );
    const dest = [1, 2, 3, 4].map((n) => ({
      ...ecg(`d${n}`, "eg2", `ECG2-${n}`, String(n)),
      school_year_id: "y-to",
    }));
    const rows = summarizeCohortCapacity({
      sourceClasses: sources,
      destinationClasses: dest,
      gradesById,
      allGrades: gradesWithPrograms,
    });
    const row = rows.find((r) => r.program === "experimental" && r.destinationGradeId === "eg2");
    assert.ok(row);
    assert.equal(row!.sourceCount, 5);
    assert.equal(row!.destinationShellCount, 4);
    assert.equal(row!.deficit, 1);
  });

  it("F: Add-shell suggestion picks next free ECG section", () => {
    const existing = [1, 2, 3, 4].map((n) =>
      ecg(`d${n}`, "eg2", `ECG2-${n}`, String(n)),
    );
    const suggestion = suggestNextShellInBucket({
      grade: gradesById.get("eg2")!,
      program: "experimental",
      existingInBucket: existing,
    });
    assert.equal(suggestion.suggestedName, "ECG2-5");
    assert.equal(suggestion.suggestedSection, "5");
    assert.equal(suggestion.namingAmbiguous, false);
  });

  it("G: Intentional merges are visible as multi-source groups", () => {
    const groups = collectIntentionalMerges({
      maps: [
        { fromClassId: "a", toClassId: "dest" },
        { fromClassId: "b", toClassId: "dest" },
        { fromClassId: "c", toClassId: "other" },
      ],
      fromLabelById: new Map([
        ["a", "ECG1-3"],
        ["b", "ECG1-4"],
        ["c", "ECG1-5"],
      ]),
      toLabelById: new Map([
        ["dest", "ECG2-4"],
        ["other", "ECG2-5"],
      ]),
    });
    assert.equal(groups.length, 1);
    assert.equal(groups[0]!.fromClassIds.length, 2);
    assert.equal(groups[0]!.toClassLabel, "ECG2-4");
  });

  it("H: Mapping suggestions are 1:1 lineage (ECG1-1→ECG2-1)", () => {
    const sources = [1, 2, 3].map((n) => ecg(`s${n}`, "eg1", `ECG1-${n}`, String(n)));
    const dest = [1, 2, 3].map((n) => ({
      ...ecg(`d${n}`, "eg2", `ECG2-${n}`, String(n)),
      school_year_id: "y-to",
    }));
    const suggestions = suggestLineageClassMaps({
      sourceClasses: sources,
      destinationClasses: dest,
      gradesById,
      allGrades: gradesWithPrograms,
    });
    assert.equal(suggestions.length, 3);
    assert.equal(
      suggestions.find((s) => s.fromClassId === "s1")?.toClassId,
      "d1",
    );
    assert.equal(
      suggestions.find((s) => s.fromClassId === "s2")?.toClassId,
      "d2",
    );
  });

  it("I: Scaffold proposals are idempotent by structure key (no duplicate names)", () => {
    const sources = [ecg("s1", "eg1", "ECG1-1", "1")];
    const first = proposeNextGradeShells({
      sourceClasses: sources,
      gradesById,
      allGrades: gradesWithPrograms,
    })[0]!;
    const key = classStructureKey(first.targetGradeLevelId, first.name, first.section);
    const existingKeys = new Set([key]);
    const second = proposeNextGradeShells({
      sourceClasses: sources,
      gradesById,
      allGrades: gradesWithPrograms,
    })[0]!;
    assert.ok(
      existingKeys.has(
        classStructureKey(second.targetGradeLevelId, second.name, second.section),
      ),
    );
  });

  it("J: Ambiguous naming does not invent a shell name", () => {
    const existing = [
      ecg("odd1", "eg2", "Homeroom Blue", "X"),
      ecg("odd2", "eg2", "Something Else", "Y"),
    ];
    const suggestion = suggestNextShellInBucket({
      grade: gradesById.get("eg2")!,
      program: "experimental",
      existingInBucket: existing,
    });
    assert.equal(suggestion.namingAmbiguous, true);
    assert.equal(suggestion.suggestedName, null);
  });
});
