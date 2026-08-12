import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildReportCardStudentRows,
  buildTransitionStudentRows,
  parseClassRecordsView,
  summarizeClassReportCards,
  summarizeClassTransitionNotes,
} from "./class-records";
import {
  classWorkspaceRecordsViewHref,
  classWorkspaceReportCardsHref,
  classWorkspaceStudentReportCardsHref,
  classWorkspaceStudentTransitionNoteHref,
} from "./constants";

describe("Class records — nested view routing", () => {
  it("parses report-cards and transition-notes views only", () => {
    assert.equal(parseClassRecordsView("report-cards"), "report-cards");
    assert.equal(parseClassRecordsView("transition-notes"), "transition-notes");
    assert.equal(parseClassRecordsView("progress-reports"), null);
    assert.equal(parseClassRecordsView(undefined), null);
    assert.equal(
      classWorkspaceRecordsViewHref("11111111-1111-4111-8111-111111111111", "report-cards"),
      "/dashboard/teacher/classes/11111111-1111-4111-8111-111111111111/records?view=report-cards",
    );
  });

  it("opens existing workflows, not a third records engine", () => {
    assert.equal(
      classWorkspaceReportCardsHref("11111111-1111-4111-8111-111111111111"),
      "/dashboard/teacher/report-cards?classId=11111111-1111-4111-8111-111111111111",
    );
    assert.equal(
      classWorkspaceStudentReportCardsHref("22222222-2222-4222-8222-222222222222"),
      "/dashboard/teacher/students/22222222-2222-4222-8222-222222222222/report-cards",
    );
    assert.equal(
      classWorkspaceStudentTransitionNoteHref("22222222-2222-4222-8222-222222222222"),
      "/dashboard/teacher/transition-notes/new?studentId=22222222-2222-4222-8222-222222222222",
    );
  });
});

describe("Class records — report card honesty", () => {
  it("I: stays Not started and does not invent 31 missing cards", () => {
    const notStarted = summarizeClassReportCards({
      isCurrentYear: true,
      reportingStarted: false,
      enrolledCount: 31,
      completeCount: null,
    });
    assert.equal(notStarted.primary, "Not started");
    assert.equal(notStarted.secondary, null);
    assert.equal(notStarted.started, false);
    assert.deepEqual(
      buildReportCardStudentRows({
        students: Array.from({ length: 31 }, (_, i) => ({
          studentId: `s${i}`,
          displayName: `Student ${i}`,
        })),
        files: [],
        term: "T1",
        reportingStarted: false,
        isCurrentYear: true,
      }),
      [],
    );
  });

  it("J: shows complete and remaining when reporting is active", () => {
    const active = summarizeClassReportCards({
      isCurrentYear: true,
      reportingStarted: true,
      enrolledCount: 31,
      completeCount: 18,
    });
    assert.equal(active.primary, "18 of 31 complete");
    assert.equal(active.secondary, "13 remaining");

    const done = summarizeClassReportCards({
      isCurrentYear: true,
      reportingStarted: true,
      enrolledCount: 31,
      completeCount: 31,
    });
    assert.equal(done.primary, "31 of 31 complete");
    assert.equal(done.secondary, null);
  });

  it("N: previous-year classes never invent current-year missing cards", () => {
    const previous = summarizeClassReportCards({
      isCurrentYear: false,
      reportingStarted: true,
      enrolledCount: 31,
      completeCount: 0,
    });
    assert.equal(previous.primary, "Previous year");
    assert.equal(previous.started, false);
    assert.deepEqual(
      buildReportCardStudentRows({
        students: [{ studentId: "s1", displayName: "Ada" }],
        files: [],
        term: "T1",
        reportingStarted: true,
        isCurrentYear: false,
      }),
      [],
    );
  });
});

describe("Class records — transition honesty", () => {
  it("K: hides transition until notes have started for the class", () => {
    const quiet = summarizeClassTransitionNotes({
      workflowStarted: false,
      enrolledCount: 31,
      submittedCount: 0,
    });
    assert.equal(quiet.relevant, false);
    assert.deepEqual(
      buildTransitionStudentRows({
        students: Array.from({ length: 31 }, (_, i) => ({
          studentId: `s${i}`,
          displayName: `Student ${i}`,
        })),
        submittedIds: new Set(),
        noteIds: new Set(),
        workflowStarted: false,
      }),
      [],
    );
  });

  it("K: shows remaining or Complete once the workflow is underway", () => {
    assert.equal(
      summarizeClassTransitionNotes({
        workflowStarted: true,
        enrolledCount: 31,
        submittedCount: 23,
      }).primary,
      "8 remaining",
    );
    assert.equal(
      summarizeClassTransitionNotes({
        workflowStarted: true,
        enrolledCount: 31,
        submittedCount: 31,
      }).primary,
      "Complete",
    );

    const rows = buildTransitionStudentRows({
      students: [
        { studentId: "a", displayName: "Ada" },
        { studentId: "b", displayName: "Bea" },
      ],
      submittedIds: new Set(["a"]),
      noteIds: new Set(["a", "b"]),
      workflowStarted: true,
    });
    assert.equal(rows[0]?.statusLabel, "Complete");
    assert.equal(rows[1]?.statusLabel, "In progress");
  });
});

describe("Class records — teacher-facing copy", () => {
  it("rejects implementation language in summaries", () => {
    const active = summarizeClassReportCards({
      isCurrentYear: true,
      reportingStarted: true,
      enrolledCount: 31,
      completeCount: 18,
    });
    const blob = `${active.primary} ${active.secondary}`;
    assert.equal(/report_card_files|student_enrollments|UUID|database|architecture/i.test(blob), false);
    assert.equal(/Current school year|rule-based|assignment snapshot/i.test(blob), false);
  });
});
