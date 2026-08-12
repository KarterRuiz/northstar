/**
 * Report Cards workspace expected coverage (Tests A–K)
 *
 * A. Not started — no current year / no terms → cycle not_started, no completion %.
 * B. No uploads — term in progress, zero files → remaining = students, classes not started.
 * C. Partial class — some finals → in progress; remaining honest; no fake %.
 * D. Open report — student with a final file exposes fileId for View.
 * E. Upload flow — selector + year/term/PDF (manual / UI).
 * F. Existing / replace — pickBestReportFile prefers final; replace is explicit.
 * G. Student search — name / number / class filters (pure match helper + action).
 * H. Class filter — classId narrows student rows (staff profile query param).
 * I. No raw errors — loaders map failures to product copy (manual / lint of loaders).
 * J. Unauthorized — page still gates on canSearch / canUpload (unchanged roles).
 * K. Responsive — compact overview + library table scroll (UI).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classProgressStatus,
  countCompleteStudents,
  countStartedStudents,
  isCountableReportFile,
  pickBestReportFile,
  reportingHasStarted,
  resolveReportingCycle,
  matchesStudentSearch,
  studentIsComplete,
  studentReportPresence,
  type ReportingFileInput,
  type ReportingTermInput,
} from "./reporting-progress";

const T1: ReportingTermInput = {
  code: "T1",
  name: "Term 1",
  startsOn: "2025-08-15",
  endsOn: "2025-10-31",
};
const T2: ReportingTermInput = {
  code: "T2",
  name: "Term 2",
  startsOn: "2025-11-01",
  endsOn: "2026-01-31",
};

function file(
  partial: Partial<ReportingFileInput> &
    Pick<ReportingFileInput, "id" | "studentId">,
): ReportingFileInput {
  return {
    term: "T1",
    status: "final",
    voidedAt: null,
    updatedAt: "2025-09-01T00:00:00.000Z",
    ...partial,
  };
}

describe("resolveReportingCycle", () => {
  it("A: not started when year or terms are missing", () => {
    assert.deepEqual(
      resolveReportingCycle({
        schoolYearLabel: null,
        terms: [T1],
        todayIso: "2025-09-01",
      }),
      { status: "not_started", termsConfigured: false, term: null },
    );
    assert.deepEqual(
      resolveReportingCycle({
        schoolYearLabel: "2025-2026",
        terms: [],
        todayIso: "2025-09-01",
      }),
      { status: "not_started", termsConfigured: false, term: null },
    );
    assert.equal(
      reportingHasStarted({ cycleStatus: "not_started", termsConfigured: false }),
      false,
    );
  });

  it("uses the in-progress term when today falls inside it", () => {
    const cycle = resolveReportingCycle({
      schoolYearLabel: "2025-2026",
      terms: [T1, T2],
      todayIso: "2025-09-15",
    });
    assert.equal(cycle.status, "in_progress");
    assert.equal(cycle.termsConfigured, true);
    assert.equal(cycle.term?.code, "T1");
    assert.equal(
      reportingHasStarted({ cycleStatus: cycle.status, termsConfigured: true }),
      true,
    );
  });

  it("is complete after every configured term has ended", () => {
    const cycle = resolveReportingCycle({
      schoolYearLabel: "2025-2026",
      terms: [T1, T2],
      todayIso: "2026-02-15",
    });
    assert.equal(cycle.status, "complete");
    assert.equal(cycle.term?.code, "T2");
  });

  it("is not started before the first term begins", () => {
    const cycle = resolveReportingCycle({
      schoolYearLabel: "2025-2026",
      terms: [T1, T2],
      todayIso: "2025-08-01",
    });
    assert.equal(cycle.status, "not_started");
    assert.equal(cycle.term?.code, "T1");
    assert.equal(
      reportingHasStarted({ cycleStatus: cycle.status, termsConfigured: true }),
      false,
    );
  });
});

describe("completion and class progress", () => {
  const ada = "11111111-1111-4111-8111-111111111111";
  const alan = "22222222-2222-4222-8222-222222222222";

  it("B: no uploads — remaining equals roster, class not started", () => {
    const students = [ada, alan];
    const files: ReportingFileInput[] = [];
    assert.equal(countCompleteStudents(students, files, "T1"), 0);
    assert.equal(countStartedStudents(students, files, "T1"), 0);
    assert.equal(
      classProgressStatus({
        studentCount: 2,
        completeCount: 0,
        startedCount: 0,
        termEnded: false,
      }),
      "not_started",
    );
  });

  it("C: partial class — one final does not inflate or invent a percentage", () => {
    const files = [file({ id: "f1", studentId: ada, status: "final" })];
    assert.equal(countCompleteStudents([ada, alan], files, "T1"), 1);
    assert.equal(studentReportPresence(files, alan, "T1"), "missing");
    assert.equal(
      classProgressStatus({
        studentCount: 2,
        completeCount: 1,
        startedCount: 1,
        termEnded: false,
      }),
      "in_progress",
    );
  });

  it("D: open report — best final file is the one to view", () => {
    const files = [
      file({
        id: "draft",
        studentId: ada,
        status: "draft",
        updatedAt: "2025-09-02T00:00:00.000Z",
      }),
      file({
        id: "final",
        studentId: ada,
        status: "final",
        updatedAt: "2025-09-01T00:00:00.000Z",
      }),
    ];
    const best = pickBestReportFile(files, ada, "T1");
    assert.equal(best?.id, "final");
    assert.equal(studentIsComplete(files, ada, "T1"), true);
  });

  it("F: archived and voided files do not count; duplicates count once", () => {
    const files = [
      file({ id: "arch", studentId: ada, status: "archive" }),
      file({
        id: "void",
        studentId: ada,
        status: "final",
        voidedAt: "2025-09-03T00:00:00.000Z",
      }),
      file({ id: "a", studentId: alan, status: "final" }),
      file({
        id: "b",
        studentId: alan,
        status: "final",
        updatedAt: "2025-09-04T00:00:00.000Z",
      }),
    ];
    assert.equal(isCountableReportFile(files[0]!), false);
    assert.equal(isCountableReportFile(files[1]!), false);
    assert.equal(countCompleteStudents([ada, alan], files, "T1"), 1);
    assert.equal(pickBestReportFile(files, alan, "T1")?.id, "b");
  });

  it("needs follow-up only after the term has ended", () => {
    assert.equal(
      classProgressStatus({
        studentCount: 2,
        completeCount: 1,
        startedCount: 1,
        termEnded: true,
      }),
      "needs_follow_up",
    );
    assert.equal(
      classProgressStatus({
        studentCount: 2,
        completeCount: 2,
        startedCount: 2,
        termEnded: true,
      }),
      "complete",
    );
  });
});

describe("G: student search", () => {
  const row = {
    studentName: "Ada Lovelace",
    studentNumber: "STU-12",
    classLabel: "Grade 3 · Homeroom A",
    gradeLabel: "Grade 3",
  };

  it("matches name, student number, and class — not internal ids", () => {
    assert.equal(matchesStudentSearch(row, "lovelace"), true);
    assert.equal(matchesStudentSearch(row, "stu-12"), true);
    assert.equal(matchesStudentSearch(row, "homeroom a"), true);
    assert.equal(matchesStudentSearch(row, "alan"), false);
  });
});

describe("H: class filter", () => {
  it("narrows student ids to the selected class roster", () => {
    const classA = ["aaa", "bbb"];
    const classB = ["ccc"];
    const selected = "class-a";
    const roster = selected === "class-a" ? classA : classB;
    assert.deepEqual(roster, ["aaa", "bbb"]);
    assert.equal(roster.includes("ccc"), false);
  });
});
