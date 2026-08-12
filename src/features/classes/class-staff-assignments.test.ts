import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLASS_ASSIGNABLE_STAFF_ROLES,
  CLASS_ASSIGNABLE_STAFF_STATUSES,
  formatStaffMemberAssignmentLabel,
  isClassAssignableStaffRole,
  isClassAssignableStaffStatus,
} from "@/lib/staff/class-assignable-staff";

import { createClassWithTeachersBodySchema } from "./class-management-schemas";

describe("class assignable staff eligibility (A–E, K)", () => {
  it("includes teacher and instructional leadership roles (A, Part 3)", () => {
    assert.deepEqual([...CLASS_ASSIGNABLE_STAFF_ROLES], ["teacher", "vice_principal", "principal"]);
    assert.equal(isClassAssignableStaffRole("teacher"), true);
    assert.equal(isClassAssignableStaffRole("principal"), true);
    assert.equal(isClassAssignableStaffRole("vice_principal"), true);
    assert.equal(isClassAssignableStaffRole("admin"), false);
    assert.equal(isClassAssignableStaffRole("registrar"), false);
  });

  it("allows draft and ready; excludes archived/disabled (B, C, E)", () => {
    assert.deepEqual([...CLASS_ASSIGNABLE_STAFF_STATUSES], ["draft", "ready"]);
    assert.equal(isClassAssignableStaffStatus("draft"), true);
    assert.equal(isClassAssignableStaffStatus("ready"), true);
    assert.equal(isClassAssignableStaffStatus("archived"), false);
    assert.equal(isClassAssignableStaffStatus("disabled"), false);
  });

  it("formats labels with email, missing email, and no UUID leakage (D, K)", () => {
    assert.equal(
      formatStaffMemberAssignmentLabel({
        full_name: "Nadia Ruiz",
        email: "nadia@example.com",
      }),
      "Nadia Ruiz — nadia@example.com",
    );
    assert.equal(
      formatStaffMemberAssignmentLabel({
        full_name: "Abi A",
        email: null,
      }),
      "Abi A — No email yet",
    );
    assert.equal(
      formatStaffMemberAssignmentLabel({
        first_name: "Abi",
        last_name: "A",
        email: "",
      }),
      "Abi A — No email yet",
    );
    const noIdentity = formatStaffMemberAssignmentLabel({
      role: "teacher",
      email: null,
      full_name: null,
    });
    assert.equal(noIdentity, "Teacher — No email yet");
    assert.equal(noIdentity.includes("…"), false);
  });

  it("distinguishes duplicate names via email (K)", () => {
    const a = formatStaffMemberAssignmentLabel({
      full_name: "Alex Ruiz",
      email: "alex.a@school.edu",
    });
    const b = formatStaffMemberAssignmentLabel({
      full_name: "Alex Ruiz",
      email: "alex.b@school.edu",
    });
    assert.notEqual(a, b);
    assert.match(a, /alex\.a@school\.edu/);
    assert.match(b, /alex\.b@school\.edu/);
  });
});

describe("create class with teachers schema (I, J)", () => {
  const base = {
    schoolYearId: "11111111-1111-4111-8111-111111111111",
    gradeLevelId: "22222222-2222-4222-8222-222222222222",
    name: "ECG1-2",
    section: "A",
    homeroomStaffMemberId: "33333333-3333-4333-8333-333333333333",
    additionalTeachers: [] as Array<{ staffMemberId: string; uiRole: "co_teacher" }>,
  };

  it("accepts staff_member ids for homeroom and additional teachers", () => {
    const parsed = createClassWithTeachersBodySchema.safeParse({
      ...base,
      additionalTeachers: [
        {
          staffMemberId: "44444444-4444-4444-8444-444444444444",
          uiRole: "co_teacher",
        },
      ],
    });
    assert.equal(parsed.success, true);
  });

  it("rejects additional teachers that duplicate the homeroom staff member", () => {
    const parsed = createClassWithTeachersBodySchema.safeParse({
      ...base,
      additionalTeachers: [
        {
          staffMemberId: base.homeroomStaffMemberId,
          uiRole: "co_teacher",
        },
      ],
    });
    assert.equal(parsed.success, false);
  });
});
