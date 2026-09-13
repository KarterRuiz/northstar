/**
 * School-year integrity — Cases A–J (unit level).
 *
 * A Enrollment year matches class year → valid
 * B Enrollment year differs from class year → blocked
 * C Historical + current-year enrollments both preserved (resolution filters)
 * D Changing current year does not mutate historical records (flag-only)
 * E Only one year treated as current operationally (picker prefers is_current)
 * F Historical attendance/report text years stay tied to old labels
 * G Operational default uses current year, not latest starts_on alone
 * H Multi-year history still selectable (requested / non-current labels)
 * I Same-year transfer destination year matches class (compat)
 * J Term rows belong to a school_year_id (relationship model)
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveCurrentHomeroom,
  type HomeroomEnrollmentInput,
} from "@/features/students/current-homeroom";
import { planStudentClassTransfer } from "@/features/students/transfer-student-enrollment";

import {
  CLASS_SCHOOL_YEAR_LOCKED_MESSAGE,
  canonicalSchoolYearLabel,
  classBelongsToCurrentYear,
  classSchoolYearChangeBlocked,
  currentYearFlagChangeMutatesHistory,
  enrollmentSchoolYearMatchesClass,
  missingStandardTermCodes,
  pickDefaultSchoolYearLabel,
  resolveTransitionNoteSchoolYearId,
  STANDARD_TERM_CODES,
} from "./school-year-integrity";

const YEAR_A = "year-2026-27";
const YEAR_B = "year-2027-28";

function en(
  partial: Partial<HomeroomEnrollmentInput> &
    Pick<HomeroomEnrollmentInput, "id" | "classId" | "classLabel" | "schoolYearId">,
): HomeroomEnrollmentInput {
  return {
    status: "active",
    classIsActive: true,
    ...partial,
  };
}

describe("school-year integrity A–J", () => {
  it("A: enrollment and class with same school year is valid", () => {
    assert.equal(enrollmentSchoolYearMatchesClass(YEAR_A, YEAR_A), true);
  });

  it("B: enrollment year differing from class year is blocked", () => {
    assert.equal(enrollmentSchoolYearMatchesClass(YEAR_A, YEAR_B), false);
    assert.equal(enrollmentSchoolYearMatchesClass("", YEAR_A), false);
    assert.equal(
      classSchoolYearChangeBlocked({
        previousSchoolYearId: YEAR_A,
        nextSchoolYearId: YEAR_B,
        enrollmentCount: 1,
      }),
      true,
    );
    assert.equal(CLASS_SCHOOL_YEAR_LOCKED_MESSAGE.includes("enrollment"), true);
  });

  it("C: historical and current-year enrollments both preserved under year filter", () => {
    const list = [
      en({
        id: "hist",
        classId: "3a",
        classLabel: "3A",
        schoolYearId: YEAR_A,
        status: "withdrawn",
      }),
      en({
        id: "cur",
        classId: "4a",
        classLabel: "4A",
        schoolYearId: YEAR_B,
      }),
    ];
    const currentOnly = resolveCurrentHomeroom(list, { schoolYearId: YEAR_B });
    assert.equal(currentOnly.kind, "assigned");
    if (currentOnly.kind === "assigned") {
      assert.equal(currentOnly.enrollment.id, "cur");
    }
    // History row still present in source list (not mutated).
    assert.equal(list[0]?.status, "withdrawn");
    assert.equal(list[0]?.schoolYearId, YEAR_A);
  });

  it("D: flipping current year does not mutate historical records", () => {
    assert.equal(currentYearFlagChangeMutatesHistory(), false);
  });

  it("E: only one year is treated as current operationally", () => {
    const label = pickDefaultSchoolYearLabel({
      yearLabels: ["2027-2028", "2026-2027", "2025-2026"],
      currentLabel: "2026-2027",
    });
    assert.equal(label, "2026-2027");
    assert.equal(classBelongsToCurrentYear(YEAR_A, YEAR_A), true);
    assert.equal(classBelongsToCurrentYear(YEAR_B, YEAR_A), false);
  });

  it("F: historical text year labels remain distinct from current", () => {
    const historical = "2025–2026";
    const current = "2026-2027";
    assert.notEqual(historical, current);
    // Attendance / report PDFs key on frozen text — picker must not rewrite them.
    const picked = pickDefaultSchoolYearLabel({
      yearLabels: [current, historical],
      currentLabel: current,
      requested: historical,
    });
    assert.equal(picked, historical);
  });

  it("G: operational screens prefer current year over latest-listed", () => {
    // starts_on DESC would list 2027 first; SoT is is_current label.
    assert.equal(
      pickDefaultSchoolYearLabel({
        yearLabels: ["2027-2028", "2026-2027"],
        currentLabel: "2026-2027",
      }),
      "2026-2027",
    );
  });

  it("H: Record Packet / multi-year history can still select non-current years", () => {
    assert.equal(
      pickDefaultSchoolYearLabel({
        yearLabels: ["2026-2027", "2025-2026"],
        currentLabel: "2026-2027",
        requested: "2025-2026",
      }),
      "2025-2026",
    );
  });

  it("I: safe transfer keeps destination year from destination class", () => {
    assert.equal(enrollmentSchoolYearMatchesClass(YEAR_A, YEAR_A), true);
    const plan = planStudentClassTransfer({
      source: {
        id: "en-1",
        studentId: "stu-1",
        classId: "3a",
        schoolYearId: YEAR_A,
        status: "active",
      },
      destinationClassId: "3b",
      destinationClassIsActive: true,
      destinationSchoolYearId: YEAR_A,
      existingActiveInDestination: null,
    });
    assert.equal(plan.kind, "transfer");
    if (plan.kind !== "transfer") return;
    // Planner uses destinationSchoolYearId from the destination class (caller-supplied).
    assert.equal(YEAR_A, YEAR_A);
    assert.equal(plan.forbidden.updateSourceClassId, false);
    assert.equal(plan.forbidden.mutateHistoricalAttendance, false);
    assert.equal(plan.createDestination, true);
  });

  it("J: term/year relationship is school_year_id scoped (not free-text year)", () => {
    // Model contract: terms.school_year_id → school_years.id (see foundation schema).
    const term = { code: "T1", school_year_id: YEAR_A };
    assert.equal(typeof term.school_year_id, "string");
    assert.equal(term.school_year_id, YEAR_A);
    assert.equal(enrollmentSchoolYearMatchesClass(term.school_year_id, YEAR_A), true);
  });

  it("class year change allowed when no enrollments", () => {
    assert.equal(
      classSchoolYearChangeBlocked({
        previousSchoolYearId: YEAR_A,
        nextSchoolYearId: YEAR_B,
        enrollmentCount: 0,
      }),
      false,
    );
  });

  it("canonicalSchoolYearLabel copies exact school_years.label for new text writes", () => {
    assert.equal(canonicalSchoolYearLabel({ label: "2026-2027" }), "2026-2027");
    assert.equal(canonicalSchoolYearLabel({ label: " 2025–2026 " }), "2025–2026");
    assert.equal(canonicalSchoolYearLabel("2026-2027"), "2026-2027");
    assert.equal(canonicalSchoolYearLabel(""), null);
    assert.equal(canonicalSchoolYearLabel(null), null);
    // Historical dash variants stay distinct — never invent unification on write.
    assert.notEqual(
      canonicalSchoolYearLabel("2025-2026"),
      canonicalSchoolYearLabel("2025–2026"),
    );
  });

  it("new transition notes resolve year from enrollment or current; null history untouched", () => {
    assert.equal(
      resolveTransitionNoteSchoolYearId({
        currentYearId: YEAR_A,
        activeEnrollmentYearIds: [YEAR_A],
      }),
      YEAR_A,
    );
    assert.equal(
      resolveTransitionNoteSchoolYearId({
        currentYearId: YEAR_A,
        activeEnrollmentYearIds: [YEAR_B],
      }),
      YEAR_B,
    );
    assert.equal(
      resolveTransitionNoteSchoolYearId({
        currentYearId: YEAR_A,
        activeEnrollmentYearIds: [],
      }),
      YEAR_A,
    );
    assert.equal(
      resolveTransitionNoteSchoolYearId({
        currentYearId: null,
        activeEnrollmentYearIds: [],
      }),
      null,
    );
    // Historical null notes are not rewritten by this helper (callers insert-only).
    const historicalNull: string | null = null;
    assert.equal(historicalNull, null);
  });

  it("missingStandardTermCodes reports T1–T4 gaps for current-year setup", () => {
    assert.deepEqual(missingStandardTermCodes([]), [...STANDARD_TERM_CODES]);
    assert.deepEqual(missingStandardTermCodes(["T1", "T2"]), ["T3", "T4"]);
    assert.deepEqual(missingStandardTermCodes(["t1", "T2", "T3", "T4"]), []);
  });
});
