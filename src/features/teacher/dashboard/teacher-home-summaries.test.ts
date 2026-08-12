import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attendanceQuickAccessSummary,
  attendanceStatusForClass,
  checkInDetailLabel,
  classBelongsToCurrentYear,
  formatAssignmentRole,
  formatClassTitle,
  pickCheckInReason,
  rankCheckInStudents,
  reportCardsQuickAccessSummary,
  summarizeTeacherRecords,
  supportQuickAccessSummary,
  TEACHER_CHECK_IN_REASON_LABEL,
} from "./teacher-home-summaries";

describe("Teacher Home — school year filter", () => {
  it("keeps only classes on the canonical current year", () => {
    assert.equal(classBelongsToCurrentYear("year-26", "year-26"), true);
    assert.equal(classBelongsToCurrentYear("year-25", "year-26"), false);
    assert.equal(classBelongsToCurrentYear(null, "year-26"), false);
    assert.equal(classBelongsToCurrentYear("year-25", null), true);
  });
});

describe("Teacher Home — attendance", () => {
  it("A/C/D marks missing vs complete and skips empty classes", () => {
    assert.equal(
      attendanceStatusForClass({ studentCount: 31, markedCount: 0 }),
      "not_submitted",
    );
    assert.equal(
      attendanceStatusForClass({ studentCount: 31, markedCount: 31 }),
      "complete",
    );
    assert.equal(
      attendanceStatusForClass({ studentCount: 0, markedCount: 0 }),
      "not_required",
    );
  });
});

describe("Teacher Home — check-in reasons", () => {
  it("uses plain-language reasons and keeps one row per student", () => {
    assert.equal(
      pickCheckInReason({
        attendanceConcern: true,
        missingWork: true,
        academicRisk: true,
        behaviorConcern: true,
        followUpDue: true,
        openPlan: true,
      }),
      "attendance",
    );
    assert.equal(
      pickCheckInReason({
        attendanceConcern: false,
        missingWork: true,
        academicRisk: true,
        behaviorConcern: false,
        followUpDue: false,
        openPlan: false,
      }),
      "missing_work",
    );
    assert.equal(
      pickCheckInReason({
        attendanceConcern: false,
        missingWork: false,
        academicRisk: true,
        behaviorConcern: false,
        followUpDue: false,
        openPlan: false,
      }),
      "academic",
    );
    assert.equal(
      pickCheckInReason({
        attendanceConcern: false,
        missingWork: false,
        academicRisk: false,
        behaviorConcern: false,
        followUpDue: false,
        openPlan: false,
      }),
      null,
    );
    const ranked = rankCheckInStudents([
      { studentId: "a", reason: "plan" as const },
      { studentId: "b", reason: "attendance" as const },
      { studentId: "a", reason: "support" as const },
      { studentId: "c", reason: "follow_up" as const },
      { studentId: "d", reason: "academic" as const },
    ]);
    assert.deepEqual(
      ranked.map((row) => row.studentId),
      ["b", "d", "a", "c"],
    );
  });

  it("never exposes thresholds in primary check-in copy", () => {
    const labels = Object.values(TEACHER_CHECK_IN_REASON_LABEL).join(" ");
    assert.equal(/3\+|70%|medium\/high|below/i.test(labels), false);
    assert.equal(
      checkInDetailLabel({ reason: "missing_work", missingAssignmentCount: 4 }),
      "4 missing assignments",
    );
    assert.equal(
      checkInDetailLabel({ reason: "academic", missingAssignmentCount: 4 }),
      "Academic follow-up",
    );
    assert.equal(
      checkInDetailLabel({ reason: "attendance", missingAssignmentCount: 0 }),
      "Attendance follow-up",
    );
  });
});

describe("Teacher Home — records", () => {
  it("G/I stays quiet when reporting and transition are not due", () => {
    const quiet = summarizeTeacherRecords({
      enrolledCount: 31,
      transitionSubmittedCount: 0,
      transitionWorkflowStarted: false,
      reportingStarted: false,
      reportCompleteCount: 0,
    });
    assert.equal(quiet.due, false);
    assert.equal(quiet.transition.relevant, false);
    assert.equal(quiet.reportCards.label, "Not started");
    assert.equal(quiet.emptyLabel, "Nothing due right now.");
  });

  it("H shows an honest completion summary when reporting is active", () => {
    const active = summarizeTeacherRecords({
      enrolledCount: 31,
      transitionSubmittedCount: 23,
      transitionWorkflowStarted: true,
      reportingStarted: true,
      reportCompleteCount: 18,
    });
    assert.equal(active.due, true);
    assert.equal(active.transition.label, "8 remaining");
    assert.equal(active.reportCards.label, "13 remaining");
    assert.equal(
      reportCardsQuickAccessSummary({
        reportingStarted: true,
        enrolledCount: 31,
        completeCount: 18,
      }),
      "13 remaining",
    );
  });
});

describe("Teacher Home — copy helpers", () => {
  it("formats class cards and quick-access summaries", () => {
    assert.equal(formatClassTitle("5B", null), "5B");
    assert.equal(formatClassTitle("Grade 5", "B"), "Grade 5 · B");
    assert.equal(formatAssignmentRole("homeroom"), "Homeroom");
    assert.equal(
      attendanceQuickAccessSummary({
        classesRequiringAttendance: 2,
        classesNotSubmitted: 1,
      }),
      "1 class remaining",
    );
    assert.equal(supportQuickAccessSummary(0), "All clear");
    assert.equal(supportQuickAccessSummary(3), "3 students to review");
  });
});
