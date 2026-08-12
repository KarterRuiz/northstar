import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canManageStudents } from "@/config/roles";

import {
  attendancePulseLabel,
  checkInPulseLabel,
  classIsCurrentSchoolYear,
  formatClassWorkspaceMeta,
  reportCardsPulseLabel,
  studentCountLabel,
} from "./class-workspace-copy";
import {
  CLASS_WORKSPACE_TAB_IDS,
  classWorkspaceAttendanceHref,
  classWorkspaceGradebookHref,
  classWorkspacePath,
  classWorkspaceStudentInterventionsHref,
  classWorkspaceStudentProfileHref,
  isClassWorkspaceTabId,
} from "./constants";

describe("Class workspace — header copy", () => {
  it("formats grade, role, and student count without school-year labels", () => {
    assert.equal(
      formatClassWorkspaceMeta({
        gradeName: "ECG1-3",
        assignmentRole: "homeroom",
        studentCount: 31,
      }),
      "ECG1-3 · Homeroom · 31 students",
    );
    assert.equal(
      formatClassWorkspaceMeta({
        gradeName: "—",
        assignmentRole: "teacher",
        studentCount: 1,
      }),
      "Teacher · 1 student",
    );
  });

  it("never mentions current-year resolver copy", () => {
    const meta = formatClassWorkspaceMeta({
      gradeName: "ECG1-3",
      assignmentRole: "homeroom",
      studentCount: 31,
    });
    assert.equal(meta.includes("Current school year"), false);
    assert.equal(meta.includes("report_card"), false);
    assert.equal(meta.includes("enrollment"), false);
  });
});

describe("Class workspace — school year integrity", () => {
  it("distinguishes historical class records from the current year", () => {
    assert.equal(classIsCurrentSchoolYear("year-26", "year-26"), true);
    assert.equal(classIsCurrentSchoolYear("year-25", "year-26"), false);
    assert.equal(classIsCurrentSchoolYear(null, "year-26"), false);
    assert.equal(classIsCurrentSchoolYear("year-25", null), true);
  });

  it("does not claim current-year report progress on a previous-year class", () => {
    assert.equal(
      reportCardsPulseLabel({
        isCurrentYear: false,
        reportingStarted: true,
        enrolledCount: 31,
        completeCount: 10,
      }),
      "Previous year",
    );
    assert.equal(
      reportCardsPulseLabel({
        isCurrentYear: true,
        reportingStarted: false,
        enrolledCount: 31,
        completeCount: null,
      }),
      "Not started",
    );
  });
});

describe("Class workspace — tabs", () => {
  it("keeps the six primary tabs in product order", () => {
    assert.deepEqual([...CLASS_WORKSPACE_TAB_IDS], [
      "overview",
      "students",
      "attendance",
      "gradebook",
      "support",
      "records",
    ]);
    assert.equal(isClassWorkspaceTabId("overview"), true);
    assert.equal(isClassWorkspaceTabId("bulk"), false);
    assert.equal(
      classWorkspacePath("11111111-1111-4111-8111-111111111111", "students"),
      "/dashboard/teacher/classes/11111111-1111-4111-8111-111111111111/students",
    );
    assert.equal(
      classWorkspaceStudentProfileHref("11111111-1111-4111-8111-111111111111"),
      "/dashboard/teacher/students/11111111-1111-4111-8111-111111111111/overview",
    );
    assert.equal(
      classWorkspaceStudentInterventionsHref("11111111-1111-4111-8111-111111111111"),
      "/dashboard/teacher/students/11111111-1111-4111-8111-111111111111/interventions",
    );
    assert.equal(
      classWorkspaceAttendanceHref("11111111-1111-4111-8111-111111111111"),
      "/dashboard/teacher/classes/11111111-1111-4111-8111-111111111111/attendance",
    );
    assert.equal(
      classWorkspaceGradebookHref("11111111-1111-4111-8111-111111111111"),
      "/dashboard/teacher/classes/11111111-1111-4111-8111-111111111111/gradebook",
    );
  });
});

describe("Class workspace — pulse labels", () => {
  it("uses teacher-facing attendance and check-in copy", () => {
    assert.equal(attendancePulseLabel("complete"), "Complete");
    assert.equal(attendancePulseLabel("not_submitted"), "Not submitted");
    assert.equal(checkInPulseLabel(3), "3");
    assert.equal(studentCountLabel(31), "31 students");
  });
});

describe("Class workspace — enrollment permission", () => {
  it("keeps official enrollment with leadership, not ordinary teachers", () => {
    assert.equal(canManageStudents("teacher"), false);
    assert.equal(canManageStudents("admin"), true);
    assert.equal(canManageStudents("principal"), true);
    assert.equal(canManageStudents("vice_principal"), true);
    assert.equal(canManageStudents("registrar"), false);
  });
});
