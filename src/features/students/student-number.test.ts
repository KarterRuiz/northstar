/**
 * Mandatory Student Number — Cases A–K (unit level).
 *
 * A create with number (parse ok)
 * B blank rejected
 * C duplicate message helper
 * D concurrent uniqueness (DB constraint documented; app maps 23505)
 * E edit change to unique (parse preserves value)
 * F blank edit rejected
 * G bulk batch dup
 * H bulk existing (match key against system set)
 * I roster independent of student number
 * J transfer preserves identity (forbidden.mutateStudentIdentity)
 * K same id+number across placement (identity distinct from roster)
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateBulkAddRows, createEmptyBulkAddRow } from "./bulk-add/validate-bulk-rows";
import { buildRosterImportPlan } from "./roster-import/build-import-plan";
import type { MappedRosterRow, RosterImportContext } from "./roster-import/types";
import { DEFAULT_ROSTER_IMPORT_OPTIONS } from "./roster-import/types";
import {
  formatStudentNumberDisplay,
  isStudentNumberUniqueViolation,
  parseStudentNumber,
  STUDENT_NUMBER_DUPLICATE_MESSAGE,
  STUDENT_NUMBER_REQUIRED_MESSAGE,
  studentNumberMatchKey,
} from "./student-number";
import {
  planStudentClassTransfer,
  type TransferEnrollmentSnapshot,
} from "./transfer-student-enrollment";

const CLASS_A = {
  id: "11111111-1111-4111-8111-111111111111",
  schoolYearId: "yyyyyyyy-yyyy-4yyy-8yyy-yyyyyyyyyyyy",
  label: "Grade 1 · ECG1-5 · 2026-27",
};

const YEAR = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const CLASS_3A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLASS_3B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STUDENT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ENROLL_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("mandatory Student Number — Cases A–F (parse / messages)", () => {
  it("A: accepts trimmed Student Number and preserves leading zeros", () => {
    const parsed = parseStudentNumber("  00123  ");
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.value, "00123");
  });

  it("B: rejects blank Student Number", () => {
    const parsed = parseStudentNumber("   ");
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.message, STUDENT_NUMBER_REQUIRED_MESSAGE);
  });

  it("C: maps unique violation to friendly duplicate message", () => {
    assert.equal(isStudentNumberUniqueViolation("students_external_id_unique"), true);
    assert.equal(isStudentNumberUniqueViolation("other", "23505"), true);
    assert.equal(STUDENT_NUMBER_DUPLICATE_MESSAGE.includes("already exists"), true);
  });

  it("D: unique violation detection supports concurrent insert races", () => {
    // Concurrent inserts both pass app validation; DB unique constraint returns 23505.
    assert.equal(isStudentNumberUniqueViolation(null, "23505"), true);
  });

  it("E: leadership may correct to another unique value (parse keeps exact trimmed)", () => {
    const next = parseStudentNumber("NS-204");
    assert.equal(next.ok, true);
    if (next.ok) assert.equal(next.value, "NS-204");
  });

  it("F: cannot clear Student Number on edit (blank rejected)", () => {
    const cleared = parseStudentNumber("");
    assert.equal(cleared.ok, false);
    if (!cleared.ok) assert.equal(cleared.message, STUDENT_NUMBER_REQUIRED_MESSAGE);
  });

  it("legacy display flags missing numbers", () => {
    assert.equal(formatStudentNumberDisplay(null), "Not assigned");
    assert.equal(formatStudentNumberDisplay("—"), "Not assigned");
    assert.equal(formatStudentNumberDisplay("NS-01"), "NS-01");
  });
});

describe("mandatory Student Number — Cases G–H (bulk)", () => {
  it("G: rejects duplicate Student Number within a batch", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "Ada",
        lastName: "Lovelace",
        studentNumber: "NS-10",
        classId: CLASS_A.id,
      },
      {
        ...createEmptyBulkAddRow("2"),
        firstName: "Alan",
        lastName: "Turing",
        studentNumber: " ns-10 ",
        classId: CLASS_A.id,
      },
    ];
    const result = validateBulkAddRows(rows, { classOptions: [CLASS_A] });
    assert.equal(result.readyCount, 1);
    assert.equal(result.needsCorrectionCount, 1);
    const issues = result.issuesByKey["2"] ?? [];
    assert.ok(issues.some((i) => i.field === "studentNumber"));
  });

  it("H: rejects Student Number that already exists in Northstar", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "Ada",
        lastName: "Lovelace",
        studentNumber: "NS-EXIST",
        classId: CLASS_A.id,
      },
    ];
    const result = validateBulkAddRows(rows, {
      classOptions: [CLASS_A],
      existingStudentNumbers: new Set([studentNumberMatchKey("NS-EXIST")]),
    });
    assert.equal(result.readyCount, 0);
    assert.ok(
      (result.issuesByKey["1"] ?? []).some(
        (i) => i.message === STUDENT_NUMBER_DUPLICATE_MESSAGE,
      ),
    );
  });

  it("I: roster # is independent of Student Number", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "Ada",
        lastName: "Lovelace",
        studentNumber: "NS-10",
        rosterNumber: "3",
        classId: CLASS_A.id,
      },
      {
        ...createEmptyBulkAddRow("2"),
        firstName: "Alan",
        lastName: "Turing",
        studentNumber: "NS-11",
        rosterNumber: "3",
        classId: CLASS_A.id,
      },
    ];
    const result = validateBulkAddRows(rows, { classOptions: [CLASS_A] });
    // Same roster # in same class fails; different Student Numbers are fine.
    assert.equal(result.readyCount, 1);
    assert.ok(
      (result.issuesByKey["2"] ?? []).some((i) => i.field === "rosterNumber"),
    );
  });
});

describe("mandatory Student Number — Cases J–K (transfer / identity)", () => {
  it("J: class transfer must not mutate student identity", () => {
    const source: TransferEnrollmentSnapshot = {
      id: ENROLL_A,
      studentId: STUDENT,
      classId: CLASS_3A,
      schoolYearId: YEAR,
      status: "active",
      rosterNumber: 7,
    };
    const plan = planStudentClassTransfer({
      source,
      destinationClassId: CLASS_3B,
      destinationClassIsActive: true,
      destinationSchoolYearId: YEAR,
      existingActiveInDestination: null,
    });
    assert.equal(plan.kind, "transfer");
    if (plan.kind !== "transfer") return;
    assert.equal(plan.forbidden.mutateStudentIdentity, false);
    assert.equal(plan.studentId, STUDENT);
  });

  it("K: same student id remains across placement; roster is class-scoped", () => {
    const source: TransferEnrollmentSnapshot = {
      id: ENROLL_A,
      studentId: STUDENT,
      classId: CLASS_3A,
      schoolYearId: YEAR,
      status: "active",
      rosterNumber: 7,
    };
    const plan = planStudentClassTransfer({
      source,
      destinationClassId: CLASS_3B,
      destinationClassIsActive: true,
      destinationSchoolYearId: YEAR,
      existingActiveInDestination: null,
    });
    assert.equal(plan.kind, "transfer");
    if (plan.kind !== "transfer") return;
    assert.equal(plan.studentId, STUDENT);
    assert.equal(plan.destinationRosterNumber, null);
    assert.notEqual(plan.destinationRosterNumber, 7);
  });
});

describe("roster import — Student Number required; existing matched", () => {
  const context: RosterImportContext = {
    schoolYearId: YEAR,
    schoolYearLabel: "2026-27",
    grades: [
      { id: "g1", name: "Grade 1", code: "G1", sortOrder: 1, isArchived: false },
    ],
    classes: [
      {
        id: CLASS_3A,
        name: "ECG1-1",
        section: null,
        gradeLevelId: "g1",
        gradeName: "Grade 1",
        gradeCode: "G1",
        schoolYearId: YEAR,
        label: "Grade 1 · ECG1-1",
        isActive: true,
      },
    ],
    students: [
      {
        id: STUDENT,
        firstName: "Ada",
        lastName: "Lovelace",
        preferredName: null,
        externalId: "NS-EXIST",
        enrollmentId: ENROLL_A,
        classId: CLASS_3A,
        classLabel: "ECG1-1",
        schoolYearId: YEAR,
        enrollmentStatus: "active",
      },
    ],
  };

  function mapped(
    rowNumber: number,
    values: MappedRosterRow["values"],
  ): MappedRosterRow {
    return {
      rowNumber,
      values,
      raw: Object.fromEntries(
        Object.entries(values).filter(([, v]) => v != null),
      ) as Record<string, string>,
    };
  }

  it("rejects new rows without Student Number", () => {
    const plan = buildRosterImportPlan(
      [
        mapped(2, {
          first_name: "New",
          last_name: "Student",
          class: "ECG1-1",
        }),
      ],
      context,
      DEFAULT_ROSTER_IMPORT_OPTIONS,
    );
    assert.ok(
      plan.issues.some(
        (i) =>
          i.severity === "error" &&
          i.message === STUDENT_NUMBER_REQUIRED_MESSAGE,
      ),
    );
  });

  it("matches existing Student Number instead of creating a duplicate", () => {
    const plan = buildRosterImportPlan(
      [
        mapped(2, {
          first_name: "Ada",
          last_name: "Lovelace",
          class: "ECG1-1",
          student_number: "NS-EXIST",
        }),
      ],
      context,
      DEFAULT_ROSTER_IMPORT_OPTIONS,
    );
    assert.equal(plan.rows[0]?.kind, "unchanged");
    assert.equal(plan.rows[0]?.existingStudentId, STUDENT);
    assert.equal(plan.newCount, 0);
  });
});
