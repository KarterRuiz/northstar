import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canManageClassEnrollment, canManageStudents } from "@/config/roles";
import {
  archiveStudentConfirmMessage,
  buildStudentDeleteSafety,
  deleteStudentConfirmMessage,
  removeFromClassConfirmMessage,
  studentDeleteBlockedMessage,
} from "@/features/students/student-delete-safety";
import {
  classDataCenterAddStudentHref,
  classDataCenterManageRosterHref,
  classDataCenterRosterImportHref,
} from "@/features/classes/class-data-center/constants";
import { classRosterEnrollmentVisible } from "@/features/teacher/class-workspace/class-roster";

describe("Roster management — permissions", () => {
  it("leadership can manage class enrollment; teachers cannot", () => {
    assert.equal(canManageClassEnrollment("admin"), true);
    assert.equal(canManageClassEnrollment("principal"), true);
    assert.equal(canManageClassEnrollment("vice_principal"), true);
    assert.equal(canManageClassEnrollment("teacher"), false);
    assert.equal(canManageClassEnrollment("registrar"), false);
    assert.equal(canManageStudents("teacher"), false);
    assert.equal(classRosterEnrollmentVisible("teacher"), false);
    assert.equal(classRosterEnrollmentVisible("admin"), true);
  });
});

describe("Roster management — delete safety", () => {
  it("allows hard delete when no dependents", () => {
    const safety = buildStudentDeleteSafety([]);
    assert.equal(safety.canHardDelete, true);
    assert.equal(safety.blockers.length, 0);
    assert.equal(studentDeleteBlockedMessage(safety), "");
  });

  it("blocks hard delete when attendance or grades exist", () => {
    const safety = buildStudentDeleteSafety(["attendance", "grades"]);
    assert.equal(safety.canHardDelete, false);
    assert.equal(safety.blockers.length, 2);
    const msg = studentDeleteBlockedMessage(safety);
    assert.match(msg, /attendance records/);
    assert.match(msg, /gradebook scores/);
    assert.match(msg, /archive/i);
  });

  it("formats confirmation copy", () => {
    assert.equal(
      removeFromClassConfirmMessage("Bianca P", "Experimental 1-5"),
      "Remove Bianca P from Experimental 1-5? The student record and history will remain in NorthStar.",
    );
    assert.equal(
      deleteStudentConfirmMessage("Bianca P"),
      "Permanently delete Bianca P? This action cannot be undone.",
    );
    assert.match(archiveStudentConfirmMessage("Bianca P"), /Archive Bianca P/);
  });
});

describe("Roster management — CDC hrefs", () => {
  const classId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

  it("scopes add / import / manage to the class when classId is provided", () => {
    assert.equal(
      classDataCenterAddStudentHref("admin", classId),
      `/dashboard/admin/students/new?classId=${classId}`,
    );
    assert.equal(
      classDataCenterRosterImportHref("admin", classId).includes(classId),
      true,
    );
    assert.equal(
      classDataCenterManageRosterHref("admin", classId),
      `/dashboard/admin/classes/${classId}/students?manage=1`,
    );
  });

  it("keeps Manage roster separate from Add student", () => {
    const manage = classDataCenterManageRosterHref("admin", classId);
    const add = classDataCenterAddStudentHref("admin", classId);
    assert.notEqual(manage, add);
    assert.match(manage, /\/classes\/.+\/students\?manage=1$/);
    assert.doesNotMatch(manage, /\/students\/new/);
    assert.match(add, /\/students\/new\?classId=/);
  });
});
