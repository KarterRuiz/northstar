import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkInDetailLabel,
  pickCheckInReason,
  rankCheckInStudents,
  TEACHER_CHECK_IN_REASON_LABEL,
  type TeacherCheckInFlags,
  type TeacherCheckInReason,
} from "@/features/teacher/dashboard/teacher-home-summaries";

import {
  checkInCategoriesFromFlags,
  checkInCategoryForReason,
  checkInSummaryLabel,
  classSupportFiltersPresent,
  classSupportFiltersUseful,
  filterClassSupport,
  type ClassSupportCategory,
} from "./class-support";
import { classWorkspaceStudentInterventionsHref } from "./constants";

const QUIET: TeacherCheckInFlags = {
  attendanceConcern: false,
  missingWork: false,
  academicRisk: false,
  behaviorConcern: false,
  followUpDue: false,
  openPlan: false,
};

function supportRow(
  studentId: string,
  flags: TeacherCheckInFlags,
  missingAssignmentCount = 0,
) {
  const reason = pickCheckInReason(flags);
  assert.ok(reason);
  return {
    studentId,
    displayName: studentId,
    reason,
    detail: checkInDetailLabel({ reason, missingAssignmentCount }),
    category: checkInCategoryForReason(reason),
    categories: checkInCategoriesFromFlags(flags),
    href: classWorkspaceStudentInterventionsHref(studentId),
  };
}

describe("Class Support — A quiet empty state", () => {
  it("stays calm when nobody needs follow-up", () => {
    assert.equal(pickCheckInReason(QUIET), null);
    assert.equal(checkInSummaryLabel(0), "No students need follow-up right now.");
    assert.equal(classSupportFiltersUseful([]), false);
    assert.deepEqual(classSupportFiltersPresent([]), ["all"]);
  });
});

describe("Class Support — B academic concern", () => {
  it("surfaces academic follow-up without grade thresholds", () => {
    const row = supportRow("maya", { ...QUIET, academicRisk: true });
    assert.equal(row.reason, "academic");
    assert.equal(row.detail, "Academic follow-up");
    assert.equal(row.category, "academic");
    assert.equal(row.detail.includes("70"), false);
  });
});

describe("Class Support — C attendance concern", () => {
  it("uses attendance follow-up, not absence counts", () => {
    const row = supportRow("leo", { ...QUIET, attendanceConcern: true });
    assert.equal(row.reason, "attendance");
    assert.equal(row.detail, "Attendance follow-up");
    assert.equal(row.category, "attendance");
    assert.equal(/3\+|absence/i.test(row.detail), false);
  });
});

describe("Class Support — D support concern", () => {
  it("uses support follow-up, not severity thresholds", () => {
    const row = supportRow("amy", { ...QUIET, behaviorConcern: true });
    assert.equal(row.reason, "support");
    assert.equal(row.detail, "Support follow-up");
    assert.equal(row.category, "support");
    assert.equal(/medium|high|2\+/i.test(row.detail), false);
  });
});

describe("Class Support — E follow-up due", () => {
  it("labels an actionable intervention follow-up in human language", () => {
    const row = supportRow("noah", { ...QUIET, followUpDue: true });
    assert.equal(row.reason, "follow_up");
    assert.equal(row.detail, "Support follow-up due");
    assert.equal(row.category, "follow_up");
    assert.deepEqual(row.categories, ["follow_up"]);
  });
});

describe("Class Support — F multiple signals", () => {
  it("keeps one primary reason and still matches every real category", () => {
    const flags: TeacherCheckInFlags = {
      ...QUIET,
      attendanceConcern: true,
      missingWork: true,
      behaviorConcern: true,
      followUpDue: true,
    };
    const row = supportRow("maya", flags, 4);
    assert.equal(row.reason, "attendance");
    assert.equal(row.detail, "Attendance follow-up");
    assert.deepEqual(row.categories, ["academic", "attendance", "support", "follow_up"]);
    assert.equal(filterClassSupport([row], "academic").length, 1);
    assert.equal(filterClassSupport([row], "attendance").length, 1);
    assert.equal(filterClassSupport([row], "support").length, 1);
    assert.equal(filterClassSupport([row], "follow_up").length, 1);
  });

  it("shows the actual missing-work count when that is the primary reason", () => {
    const row = supportRow("maya", { ...QUIET, missingWork: true }, 4);
    assert.equal(row.detail, "4 missing assignments");
    assert.equal(row.category, "academic");
  });
});

describe("Class Support — G student navigation", () => {
  it("opens the existing student interventions experience", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const href = classWorkspaceStudentInterventionsHref(id);
    assert.equal(href, `/dashboard/teacher/students/${id}/interventions`);
    assert.equal(href.includes("/classes/"), false);
    assert.equal(href.endsWith("/overview"), false);
  });
});

describe("Class Support — H unauthorized student", () => {
  it("only lists enrolled student ids from this class", () => {
    const enrolledId = "11111111-1111-4111-8111-111111111111";
    const foreignId = "99999999-9999-4999-8999-999999999999";
    const enrolled = [supportRow(enrolledId, { ...QUIET, academicRisk: true })];
    assert.equal(
      enrolled.some((row) => row.studentId === foreignId || row.href.includes(foreignId)),
      false,
    );
    assert.equal(enrolled[0]?.href.includes(enrolledId), true);
  });
});

describe("Class Support — I Home / class consistency", () => {
  it("uses the same canonical reason as Teacher Home check-in", () => {
    const flags: TeacherCheckInFlags = {
      attendanceConcern: false,
      missingWork: true,
      academicRisk: true,
      behaviorConcern: true,
      followUpDue: true,
      openPlan: true,
    };
    const reason = pickCheckInReason(flags);
    assert.equal(reason, "missing_work");
    assert.equal(TEACHER_CHECK_IN_REASON_LABEL[reason], "Missing work");
    assert.equal(
      checkInDetailLabel({ reason, missingAssignmentCount: 3 }),
      "3 missing assignments",
    );

    const homePreview = rankCheckInStudents(
      [
        { studentId: "a", reason: "academic" as const },
        { studentId: "b", reason: "attendance" as const },
        { studentId: "c", reason: "support" as const },
      ],
      5,
    );
    const classFull = rankCheckInStudents(
      [
        { studentId: "a", reason: "academic" as const },
        { studentId: "b", reason: "attendance" as const },
        { studentId: "c", reason: "support" as const },
      ],
      3,
    );
    assert.deepEqual(
      homePreview.map((row) => row.studentId),
      classFull.map((row) => row.studentId),
    );
  });
});

describe("Class Support — J responsive list, not a metric wall", () => {
  it("only offers filters that the class actually has", () => {
    const students = [
      supportRow("maya", { ...QUIET, academicRisk: true }),
      supportRow("leo", { ...QUIET, attendanceConcern: true }),
    ];
    assert.deepEqual(classSupportFiltersPresent(students), [
      "all",
      "academic",
      "attendance",
    ]);
    assert.equal(classSupportFiltersUseful(students), true);
    assert.equal(filterClassSupport(students, "support").length, 0);
    assert.equal(checkInSummaryLabel(2), "2 students to check in on");
    assert.equal(checkInSummaryLabel(1), "1 student to check in on");
  });

  it("does not invent recognition or extra KPI categories", () => {
    const known: ClassSupportCategory[] = [
      "academic",
      "attendance",
      "support",
      "follow_up",
    ];
    for (const reason of Object.keys(TEACHER_CHECK_IN_REASON_LABEL) as TeacherCheckInReason[]) {
      assert.equal(known.includes(checkInCategoryForReason(reason)), true);
    }
  });
});
