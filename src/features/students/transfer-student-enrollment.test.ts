import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isRedundantPostTransferAttempt,
  pickPreferredEnrollmentForEdit,
  planStudentClassTransfer,
  shouldTransferEnrollment,
  sortEnrollmentChoicesForEdit,
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

describe("post-transfer edit UI state", () => {
  const withdrawn = {
    id: ENROLL_A,
    status: TRANSFER_SOURCE_ENROLLMENT_STATUS,
    label: "Grade 3 · Class 3A",
  };
  const activeDest = {
    id: ENROLL_B,
    status: TRANSFER_DESTINATION_ENROLLMENT_STATUS,
    label: "Grade 3 · Class 3B",
  };

  it("prefers the new active enrollment after a successful transfer", () => {
    // Label sort alone would put 3A (withdrawn) first — must still pick active 3B.
    const preferred = pickPreferredEnrollmentForEdit([withdrawn, activeDest]);
    assert.equal(preferred?.id, ENROLL_B);
    assert.equal(preferred?.status, "active");
  });

  it("sorts active enrollment first so edit defaults are fresh", () => {
    const sorted = sortEnrollmentChoicesForEdit([withdrawn, activeDest]);
    assert.equal(sorted[0]?.id, ENROLL_B);
    assert.equal(sorted[0]?.status, "active");
    assert.equal(sorted[1]?.id, ENROLL_A);
    assert.equal(sorted[1]?.status, "withdrawn");
  });

  it("keeps withdrawn enrollment only as historical (still listed)", () => {
    const sorted = sortEnrollmentChoicesForEdit([activeDest, withdrawn]);
    assert.equal(sorted.length, 2);
    assert.ok(sorted.some((c) => c.id === ENROLL_A && c.status === "withdrawn"));
    assert.ok(sorted.some((c) => c.id === ENROLL_B && c.status === "active"));
  });

  it("treats duplicate post-success submit as redundant (no false active-enrollment error)", () => {
    assert.equal(
      isRedundantPostTransferAttempt({
        sourceStatus: "withdrawn",
        sourceClassId: CLASS_3A,
        destinationClassId: CLASS_3B,
        destinationHasActiveEnrollment: true,
      }),
      true,
    );
  });

  it("does not treat a real withdrawn→new-class attempt as redundant", () => {
    assert.equal(
      isRedundantPostTransferAttempt({
        sourceStatus: "withdrawn",
        sourceClassId: CLASS_3A,
        destinationClassId: CLASS_3B,
        destinationHasActiveEnrollment: false,
      }),
      false,
    );
  });

  it("does not mark an active source transfer as redundant", () => {
    assert.equal(
      isRedundantPostTransferAttempt({
        sourceStatus: "active",
        sourceClassId: CLASS_3A,
        destinationClassId: CLASS_3B,
        destinationHasActiveEnrollment: false,
      }),
      false,
    );
  });

  it("planner still errors on withdrawn source when destination is empty (no false success)", () => {
    const plan = planStudentClassTransfer({
      source: sourceIn3A({ status: "withdrawn" }),
      destinationClassId: CLASS_3B,
      destinationClassIsActive: true,
      destinationSchoolYearId: YEAR,
      existingActiveInDestination: null,
    });
    assert.equal(plan.kind, "error");
    if (plan.kind === "error") {
      assert.equal(plan.message, "Only an active enrollment can be transferred.");
    }
  });

  it("after success, shouldTransferEnrollment against withdrawn source+dest class is still true (form must not re-submit)", () => {
    // Documents why UI must redirect / lock: a stale form with old enrollmentId + new
    // classId would still look like a transfer and hit the planner error without guards.
    assert.equal(
      shouldTransferEnrollment({
        enrollmentId: ENROLL_A,
        beforeClassId: CLASS_3A,
        nextClassId: CLASS_3B,
      }),
      true,
    );
    assert.equal(
      isRedundantPostTransferAttempt({
        sourceStatus: "withdrawn",
        sourceClassId: CLASS_3A,
        destinationClassId: CLASS_3B,
        destinationHasActiveEnrollment: true,
      }),
      true,
    );
  });
});
