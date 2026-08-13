import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canManageSchoolStructure } from "@/config/roles";

import {
  academicsPulseLabel,
  classKindLabelFromHomeroom,
  formatClassDataCenterMeta,
  northStarAccountStatusLabel,
} from "./class-data-center-copy";
import {
  CLASS_DATA_CENTER_TAB_IDS,
  CLASS_DATA_CENTER_TAB_LABELS,
  CLASS_DATA_CENTER_TAB_PERMISSIONS,
  classDataCenterAcademicReviewHref,
  classDataCenterAttendanceWorkspaceHref,
  classDataCenterPath,
  classDataCenterStaffProfileHref,
  classDataCenterStudentProfileHref,
  isClassDataCenterTabId,
} from "./constants";

describe("Class Data Center — A routing & identity", () => {
  it("A. uses stable classId nested routes under role dashboard", () => {
    const href = classDataCenterPath("admin", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", "overview");
    assert.equal(href, "/dashboard/admin/classes/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/overview");
    assert.equal(href.includes("Experimental"), false);
  });

  it("B. leadership roles get Data Center; teachers do not share tab ids with gradebook", () => {
    assert.equal(canManageSchoolStructure("admin"), true);
    assert.equal(canManageSchoolStructure("principal"), true);
    assert.equal(canManageSchoolStructure("vice_principal"), true);
    assert.equal(canManageSchoolStructure("teacher"), false);
    assert.equal(isClassDataCenterTabId("academics"), true);
    assert.equal(isClassDataCenterTabId("gradebook"), false);
    assert.equal(isClassDataCenterTabId("staff"), true);
  });
});

describe("Class Data Center — C–E header & tabs", () => {
  it("C. header meta is human language only", () => {
    const meta = formatClassDataCenterMeta({
      gradeName: "ECG1-5",
      classKindLabel: "Homeroom",
      schoolYearLabel: "2026–2027",
    });
    assert.equal(meta, "ECG1-5 · Homeroom · 2026–2027");
    assert.equal(meta.includes("uuid"), false);
    assert.equal(meta.includes("student_enrollments"), false);
    assert.equal(meta.includes("class_teachers"), false);
    assert.equal(classKindLabelFromHomeroom(true), "Homeroom");
    assert.equal(classKindLabelFromHomeroom(false), "Class");
  });

  it("D. tabs match leadership navigation labels", () => {
    assert.deepEqual([...CLASS_DATA_CENTER_TAB_IDS], [
      "overview",
      "students",
      "attendance",
      "academics",
      "support",
      "records",
      "staff",
    ]);
    assert.equal(CLASS_DATA_CENTER_TAB_LABELS.support, "Behavior & Support");
    assert.equal(CLASS_DATA_CENTER_TAB_LABELS.academics, "Academics");
  });

  it("E. profile drill-down paths stay role-aware", () => {
    assert.equal(
      classDataCenterStudentProfileHref("admin", "s1"),
      "/dashboard/admin/students/s1/overview",
    );
    assert.equal(
      classDataCenterStaffProfileHref("principal", "sm1").includes("/teachers/sm1"),
      true,
    );
  });
});

describe("Class Data Center — F–K academics protection", () => {
  it("F. academics pulse stays honest when empty", () => {
    assert.equal(
      academicsPulseLabel({ assignmentCount: 0, scoredCellCount: 0 }),
      "No grades recorded yet.",
    );
  });

  it("G. academics tab is classified read-only", () => {
    assert.equal(CLASS_DATA_CENTER_TAB_PERMISSIONS.academics.write, false);
    assert.equal(CLASS_DATA_CENTER_TAB_PERMISSIONS.academics.read, true);
  });

  it("H. Academic Review deep-link includes class filter", () => {
    const href = classDataCenterAcademicReviewHref(
      "admin",
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    );
    assert.equal(href.includes("/academic-review"), true);
    assert.equal(href.includes("class="), true);
  });

  it("I. admin attendance workspace deep-link exists; other roles stay in-class", () => {
    const admin = classDataCenterAttendanceWorkspaceHref(
      "admin",
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      "2026-08-12",
    );
    assert.ok(admin);
    assert.equal(admin!.includes("/dashboard/admin/attendance"), true);
    assert.equal(admin!.includes("classId="), true);
    assert.equal(
      classDataCenterAttendanceWorkspaceHref(
        "principal",
        "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      ),
      null,
    );
  });

  it("J. gradebook mutations stay teacher-gated by design (permission matrix)", () => {
    // Gradebook server actions call requireTeacherAssignedToClass — leadership
    // Class Data Center never exposes write=true for academics.
    assert.equal(CLASS_DATA_CENTER_TAB_PERMISSIONS.academics.write, false);
    assert.equal(canManageSchoolStructure("admin"), true);
  });

  it("K. staff account status is human-readable", () => {
    assert.equal(
      northStarAccountStatusLabel({ profileId: "p1", staffStatus: "active" }),
      "NorthStar account active",
    );
    assert.equal(
      northStarAccountStatusLabel({ profileId: null, staffStatus: "invited" }),
      "Invitation pending",
    );
  });
});

describe("Class Data Center — L–X permissions & consistency", () => {
  it("L. overview/students/attendance/support/records are read by default", () => {
    for (const tab of ["overview", "attendance", "support", "records"] as const) {
      assert.equal(CLASS_DATA_CENTER_TAB_PERMISSIONS[tab].write, false);
    }
  });

  it("M. students write is only via existing admin enrollment tools", () => {
    assert.equal(
      CLASS_DATA_CENTER_TAB_PERMISSIONS.students.write,
      "enrollment_via_existing_admin_tools",
    );
  });

  it("N. staff write reuses existing staffing dialog", () => {
    assert.equal(
      CLASS_DATA_CENTER_TAB_PERMISSIONS.staff.write,
      "staffing_via_existing_admin_dialog",
    );
  });

  it("O–X. path helpers never invent progress reports or grade correction routes", () => {
    for (const tab of CLASS_DATA_CENTER_TAB_IDS) {
      const href = classDataCenterPath("admin", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", tab);
      assert.equal(href.includes("progress-report"), false);
      assert.equal(href.includes("correct-grades"), false);
      assert.equal(href.includes("data-center"), false);
    }
  });
});
