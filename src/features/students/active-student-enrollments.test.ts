import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OPERATIONAL_ACTIVE_ENROLLMENT_STATUS,
  isOperationallyActiveEnrollment,
} from "@/features/students/active-student-enrollments";

describe("isOperationallyActiveEnrollment", () => {
  it("is true only when enrollment is active and class is active", () => {
    assert.equal(
      isOperationallyActiveEnrollment({
        status: OPERATIONAL_ACTIVE_ENROLLMENT_STATUS,
        classIsActive: true,
      }),
      true,
    );
  });

  it("is false for active enrollment in an archived class", () => {
    assert.equal(
      isOperationallyActiveEnrollment({
        status: "active",
        classIsActive: false,
      }),
      false,
    );
  });

  it("is false for withdrawn enrollment even in an active class", () => {
    assert.equal(
      isOperationallyActiveEnrollment({
        status: "withdrawn",
        classIsActive: true,
      }),
      false,
    );
  });

  it("is false for inactive enrollment in an archived class", () => {
    assert.equal(
      isOperationallyActiveEnrollment({
        status: "inactive",
        classIsActive: false,
      }),
      false,
    );
  });
});
