/**
 * Homeroom integrity — Cases A–J (unit level).
 *
 * A one active homeroom → valid
 * B second active same year → blocked
 * C transfer 3A→3B → one current (planner + resolution)
 * D historical withdrawn → allowed
 * E active in two different years → allowed
 * F no current → Not assigned
 * G archived-class active → not current homeroom
 * H concurrent / unique index message mapping
 * I specialist path when classType distinguishes non-homeroom
 * J Student Number / UUID unchanged across transfer (planner forbids identity mutate)
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACTIVE_HOMEROOM_CONFLICT_MESSAGE,
  activeHomeroomConflictMessage,
  formatHomeroomDisplay,
  HOMEROOM_NOT_ASSIGNED_LABEL,
  isHomeroomClass,
  resolveCurrentHomeroom,
  wouldCreateActiveHomeroomConflict,
  type HomeroomEnrollmentInput,
} from "@/features/students/current-homeroom";
import {
  planStudentClassTransfer,
  type TransferEnrollmentSnapshot,
} from "@/features/students/transfer-student-enrollment";

const YEAR_2627 = "year-2026-27";
const YEAR_2728 = "year-2027-28";

function en(partial: Partial<HomeroomEnrollmentInput> & Pick<HomeroomEnrollmentInput, "id" | "classId" | "classLabel">): HomeroomEnrollmentInput {
  return {
    schoolYearId: YEAR_2627,
    status: "active",
    classIsActive: true,
    ...partial,
  };
}

describe("homeroom integrity A–J", () => {
  it("A: one active homeroom in a school year is valid", () => {
    const resolution = resolveCurrentHomeroom([
      en({ id: "e1", classId: "3a", classLabel: "International 3A" }),
    ]);
    assert.equal(resolution.kind, "assigned");
    assert.equal(resolution.conflict, false);
    assert.equal(formatHomeroomDisplay(resolution), "International 3A");
    assert.equal(
      wouldCreateActiveHomeroomConflict({
        schoolYearId: YEAR_2627,
        existingActiveInYear: [],
      }),
      false,
    );
  });

  it("B: second active homeroom same school year is blocked", () => {
    assert.equal(
      wouldCreateActiveHomeroomConflict({
        schoolYearId: YEAR_2627,
        existingActiveInYear: [
          { id: "e1", schoolYearId: YEAR_2627, status: "active" },
        ],
      }),
      true,
    );
    assert.equal(ACTIVE_HOMEROOM_CONFLICT_MESSAGE.includes("active homeroom"), true);
  });

  it("C: transfer 3A → 3B leaves one current homeroom (withdraw + new)", () => {
    const source: TransferEnrollmentSnapshot = {
      id: "en-3a",
      studentId: "stu-1",
      classId: "class-3a",
      schoolYearId: YEAR_2627,
      status: "active",
    };
    const plan = planStudentClassTransfer({
      source,
      destinationClassId: "class-3b",
      destinationClassIsActive: true,
      destinationSchoolYearId: YEAR_2627,
      existingActiveInDestination: null,
    });
    assert.equal(plan.kind, "transfer");
    if (plan.kind !== "transfer") return;
    assert.equal(plan.sourceStatusAfter, "withdrawn");
    assert.equal(plan.createDestination, true);
    assert.equal(plan.forbidden.updateSourceClassId, false);
    assert.equal(plan.forbidden.mutateStudentIdentity, false);

    // After transfer: only 3B operational.
    const after = resolveCurrentHomeroom([
      en({
        id: "en-3a",
        classId: "class-3a",
        classLabel: "International 3A",
        status: "withdrawn",
      }),
      en({
        id: "en-3b",
        classId: "class-3b",
        classLabel: "International 3B",
      }),
    ]);
    assert.equal(after.kind, "assigned");
    if (after.kind === "assigned") {
      assert.equal(after.enrollment.classId, "class-3b");
    }
  });

  it("D: historical withdrawn homerooms do not block a new active", () => {
    assert.equal(
      wouldCreateActiveHomeroomConflict({
        schoolYearId: YEAR_2627,
        existingActiveInYear: [
          { id: "old", schoolYearId: YEAR_2627, status: "withdrawn" },
        ],
      }),
      false,
    );
    const resolution = resolveCurrentHomeroom([
      en({
        id: "old",
        classId: "3a",
        classLabel: "International 3A",
        status: "withdrawn",
      }),
      en({ id: "new", classId: "3b", classLabel: "International 3B" }),
    ]);
    assert.equal(resolution.kind, "assigned");
  });

  it("E: active homerooms in different school years are allowed", () => {
    assert.equal(
      wouldCreateActiveHomeroomConflict({
        schoolYearId: YEAR_2728,
        existingActiveInYear: [
          { id: "e1", schoolYearId: YEAR_2627, status: "active" },
        ],
      }),
      false,
    );
    const bothYears = resolveCurrentHomeroom(
      [
        en({ id: "e1", classId: "3a", classLabel: "3A", schoolYearId: YEAR_2627 }),
        en({
          id: "e2",
          classId: "4a",
          classLabel: "4A",
          schoolYearId: YEAR_2728,
        }),
      ],
      { schoolYearId: YEAR_2627 },
    );
    assert.equal(bothYears.kind, "assigned");
    if (bothYears.kind === "assigned") {
      assert.equal(bothYears.enrollment.classId, "3a");
    }
  });

  it("F: no current active homeroom → Not assigned", () => {
    const resolution = resolveCurrentHomeroom([]);
    assert.equal(resolution.kind, "not_assigned");
    assert.equal(formatHomeroomDisplay(resolution), HOMEROOM_NOT_ASSIGNED_LABEL);
  });

  it("G: archived-class enrollment marked active is not current homeroom", () => {
    const resolution = resolveCurrentHomeroom([
      en({
        id: "e1",
        classId: "old",
        classLabel: "Homeroom · 6A",
        classIsActive: false,
      }),
    ]);
    assert.equal(resolution.kind, "not_assigned");
    // Integrity still blocks a second active row in the same year until withdrawn.
    assert.equal(
      wouldCreateActiveHomeroomConflict({
        schoolYearId: YEAR_2627,
        existingActiveInYear: [
          { id: "e1", schoolYearId: YEAR_2627, status: "active" },
        ],
      }),
      true,
    );
  });

  it("H: concurrent unique violation maps to stable conflict message", () => {
    assert.equal(
      activeHomeroomConflictMessage(
        'duplicate key value violates unique constraint "student_enrollments_one_active_homeroom_per_year_uidx"',
      ),
      ACTIVE_HOMEROOM_CONFLICT_MESSAGE,
    );
  });

  it("I: specialist membership is not blocked when classType distinguishes it", () => {
    assert.equal(isHomeroomClass({ classType: null }), true);
    assert.equal(isHomeroomClass({ classType: "homeroom" }), true);
    assert.equal(isHomeroomClass({ classType: "subject" }), false);

    assert.equal(
      wouldCreateActiveHomeroomConflict({
        schoolYearId: YEAR_2627,
        existingActiveInYear: [
          {
            id: "math",
            schoolYearId: YEAR_2627,
            status: "active",
            classType: "subject",
          },
        ],
      }),
      false,
    );

    const resolution = resolveCurrentHomeroom([
      en({
        id: "math",
        classId: "math-1",
        classLabel: "Math · 3",
        classType: "subject",
      }),
      en({
        id: "hr",
        classId: "3a",
        classLabel: "International 3A",
        classType: "homeroom",
      }),
    ]);
    assert.equal(resolution.kind, "assigned");
    if (resolution.kind === "assigned") {
      assert.equal(resolution.enrollment.classId, "3a");
    }
  });

  it("J: transfer plan never mutates Student Number / UUID (identity)", () => {
    const plan = planStudentClassTransfer({
      source: {
        id: "en-1",
        studentId: "stu-uuid-unchanged",
        classId: "3a",
        schoolYearId: YEAR_2627,
        status: "active",
      },
      destinationClassId: "3b",
      destinationClassIsActive: true,
      destinationSchoolYearId: YEAR_2627,
      existingActiveInDestination: null,
    });
    assert.equal(plan.kind, "transfer");
    if (plan.kind !== "transfer") return;
    assert.equal(plan.studentId, "stu-uuid-unchanged");
    assert.equal(plan.forbidden.mutateStudentIdentity, false);
    assert.equal(plan.forbidden.updateSourceClassId, false);
  });

  it("admin conflict display does not silently pick a single label", () => {
    const resolution = resolveCurrentHomeroom([
      en({ id: "e2", classId: "3b", classLabel: "International 3B" }),
      en({ id: "e1", classId: "3a", classLabel: "International 3A" }),
    ]);
    assert.equal(resolution.kind, "conflict");
    assert.equal(
      formatHomeroomDisplay(resolution, { forAdmin: true }),
      "Integrity: 2 active homerooms",
    );
    assert.equal(formatHomeroomDisplay(resolution), "International 3A");
  });
});
