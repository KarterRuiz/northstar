import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  planStudentClassTransfer,
  shouldTransferEnrollment,
  transferClassConfirmMessage,
  TRANSFER_DESTINATION_ENROLLMENT_STATUS,
  TRANSFER_SOURCE_ENROLLMENT_STATUS,
  type TransferEnrollmentSnapshot,
} from "./transfer-student-enrollment";

const CLASS_3A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLASS_3B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STUDENT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ENROLL_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ENROLL_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const YEAR = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function sourceIn3A(
  overrides: Partial<TransferEnrollmentSnapshot> = {},
): TransferEnrollmentSnapshot {
  return {
    id: ENROLL_A,
    studentId: STUDENT,
    classId: CLASS_3A,
    schoolYearId: YEAR,
    status: "active",
    rosterNumber: 7,
    ...overrides,
  };
}

describe("planStudentClassTransfer — CASE A (3A → 3B)", () => {
  it("withdraws 3A in place and creates a new active 3B enrollment", () => {
    const plan = planStudentClassTransfer({
      source: sourceIn3A(),
      destinationClassId: CLASS_3B,
      destinationClassIsActive: true,
      destinationSchoolYearId: YEAR,
      existingActiveInDestination: null,
    });

    assert.equal(plan.kind, "transfer");
    if (plan.kind !== "transfer") return;

    assert.equal(plan.sourceClassId, CLASS_3A);
    assert.equal(plan.destinationClassId, CLASS_3B);
    assert.equal(plan.sourceStatusAfter, TRANSFER_SOURCE_ENROLLMENT_STATUS);
    assert.equal(plan.sourceStatusAfter, "withdrawn");
    assert.equal(plan.createDestination, true);
    assert.equal(plan.existingDestinationEnrollmentId, null);
    assert.equal(plan.destinationStatus, TRANSFER_DESTINATION_ENROLLMENT_STATUS);
    assert.equal(plan.destinationRosterNumber, null);
    // Must not steal roster # from historical 3A enrollment.
    assert.notEqual(plan.destinationRosterNumber, 7);
    assert.equal(plan.forbidden.updateSourceClassId, false);
    assert.equal(plan.forbidden.mutateHistoricalAttendance, false);
    assert.equal(plan.forbidden.mutateHistoricalReportCards, false);
    assert.equal(plan.forbidden.mutateStudentIdentity, false);
  });
});

describe("planStudentClassTransfer — CASE B (already active in 3B)", () => {
  it("withdraws 3A and does not create a duplicate active 3B", () => {
    const plan = planStudentClassTransfer({
      source: sourceIn3A(),
      destinationClassId: CLASS_3B,
      destinationClassIsActive: true,
      destinationSchoolYearId: YEAR,
      existingActiveInDestination: { id: ENROLL_B },
    });

    assert.equal(plan.kind, "transfer");
    if (plan.kind !== "transfer") return;

    assert.equal(plan.createDestination, false);
    assert.equal(plan.existingDestinationEnrollmentId, ENROLL_B);
    assert.equal(plan.sourceStatusAfter, "withdrawn");
    assert.equal(plan.forbidden.updateSourceClassId, false);
  });
});

describe("planStudentClassTransfer — CASE C (failure / no corrupt placement)", () => {
  it("refuses transfer when source is not active (no ambiguous partial plan)", () => {
    const plan = planStudentClassTransfer({
      source: sourceIn3A({ status: "withdrawn" }),
      destinationClassId: CLASS_3B,
      destinationClassIsActive: true,
      destinationSchoolYearId: YEAR,
      existingActiveInDestination: null,
    });
    assert.equal(plan.kind, "error");
    if (plan.kind === "error") {
      assert.match(plan.message, /active enrollment/i);
    }
  });

  it("refuses inactive destination before any mutation", () => {
    const plan = planStudentClassTransfer({
      source: sourceIn3A(),
      destinationClassId: CLASS_3B,
      destinationClassIsActive: false,
      destinationSchoolYearId: YEAR,
      existingActiveInDestination: null,
    });
    assert.equal(plan.kind, "error");
    if (plan.kind === "error") {
      assert.match(plan.message, /inactive/i);
    }
  });

  it("never plans an in-place class_id rewrite", () => {
    const plan = planStudentClassTransfer({
      source: sourceIn3A(),
      destinationClassId: CLASS_3B,
      destinationClassIsActive: true,
      destinationSchoolYearId: YEAR,
      existingActiveInDestination: null,
    });
    assert.equal(plan.kind, "transfer");
    if (plan.kind !== "transfer") return;
    // Contract for RPC / helper: source class stays 3A; only status changes.
    assert.equal(plan.sourceClassId, CLASS_3A);
    assert.equal(plan.forbidden.updateSourceClassId, false);
  });
});

describe("planStudentClassTransfer — CASE D (historical records untouched)", () => {
  it("plans no attendance / report-card / identity mutations", () => {
    const plan = planStudentClassTransfer({
      source: sourceIn3A(),
      destinationClassId: CLASS_3B,
      destinationClassIsActive: true,
      destinationSchoolYearId: YEAR,
      existingActiveInDestination: null,
    });
    assert.equal(plan.kind, "transfer");
    if (plan.kind !== "transfer") return;
    assert.deepEqual(plan.forbidden, {
      updateSourceClassId: false,
      mutateHistoricalAttendance: false,
      mutateHistoricalReportCards: false,
      mutateStudentIdentity: false,
    });
  });
});

describe("shouldTransferEnrollment — CASE E (name-only edits)", () => {
  it("is false when class is unchanged (profile-only save)", () => {
    assert.equal(
      shouldTransferEnrollment({
        enrollmentId: ENROLL_A,
        beforeClassId: CLASS_3A,
        nextClassId: CLASS_3A,
      }),
      false,
    );
  });

  it("is true when class changes on an existing enrollment", () => {
    assert.equal(
      shouldTransferEnrollment({
        enrollmentId: ENROLL_A,
        beforeClassId: CLASS_3A,
        nextClassId: CLASS_3B,
      }),
      true,
    );
  });

  it("is false when there is no enrollment to transfer", () => {
    assert.equal(
      shouldTransferEnrollment({
        enrollmentId: null,
        beforeClassId: null,
        nextClassId: CLASS_3B,
      }),
      false,
    );
  });
});

describe("transferClassConfirmMessage", () => {
  it("explains preserve + new enrollment", () => {
    const msg = transferClassConfirmMessage({
      studentDisplayName: "Ada Lovelace",
      fromClassLabel: "3A",
      toClassLabel: "3B",
    });
    assert.match(msg, /Ada Lovelace/);
    assert.match(msg, /withdrawn/);
    assert.match(msg, /new active enrollment/);
    assert.match(msg, /Attendance/);
  });
});
