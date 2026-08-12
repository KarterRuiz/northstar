import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickCheckInReason } from "@/features/teacher/dashboard/teacher-home-summaries";

import {
  CLASS_ROSTER_FILTERS,
  classRosterEnrollmentVisible,
  classRosterFiltersUseful,
  classRosterHasStudentNumbers,
  classRosterSearchText,
  filterClassRoster,
  matchesClassRosterSearch,
  rosterSupportLabel,
  summarizeRosterStudentRecords,
  teacherStudentDisplayName,
} from "./class-roster";
import { classWorkspaceStudentProfileHref } from "./constants";

function rosterStudent(index: number, overrides: Partial<{
  displayName: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  studentNumber: string | null;
  needsSupport: boolean;
}> = {}) {
  const n = String(index + 1).padStart(2, "0");
  const firstName = overrides.firstName ?? `Student`;
  const lastName = overrides.lastName ?? String.fromCharCode(65 + (index % 26));
  const preferredName = overrides.preferredName ?? null;
  const displayName =
    overrides.displayName ??
    teacherStudentDisplayName({ preferredName, firstName, lastName });
  const studentNumber = overrides.studentNumber ?? `NS-${n}`;
  return {
    studentId: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
    displayName,
    studentNumber,
    searchText: classRosterSearchText({
      displayName,
      firstName,
      lastName,
      preferredName,
      studentNumber,
    }),
    href: classWorkspaceStudentProfileHref(
      `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
    ),
    needsSupport: overrides.needsSupport ?? false,
  };
}

describe("Class roster — 31-student scan", () => {
  it("A: keeps a 31-student roster intact and searchable without per-row actions", () => {
    const students = Array.from({ length: 31 }, (_, i) =>
      rosterStudent(i, {
        needsSupport: i === 2,
        preferredName: i === 7 ? "Agnes Z" : null,
        firstName: i === 7 ? "Agnes" : "Student",
      }),
    );
    assert.equal(students.length, 31);
    assert.equal(filterClassRoster(students, { query: "", filter: "all" }).length, 31);
    assert.equal(
      students.some((row) => /overview|academics|transition|report card/i.test(row.displayName)),
      false,
    );
    assert.ok(students.every((row) => row.href.includes("/students/")));
  });
});

describe("Class roster — student profile navigation", () => {
  it("B: name/row href is the existing Student Profile overview", () => {
    const href = classWorkspaceStudentProfileHref("22222222-2222-4222-8222-222222222222");
    assert.equal(
      href,
      "/dashboard/teacher/students/22222222-2222-4222-8222-222222222222/overview",
    );
    assert.equal(href.includes("/classes/"), false);
    assert.equal(href.includes("academics"), false);
  });

  it("C: roster only mints profile hrefs for enrolled student ids", () => {
    const enrolled = rosterStudent(0);
    const foreignId = "99999999-9999-4999-8999-999999999999";
    assert.equal(enrolled.href.includes(enrolled.studentId), true);
    assert.equal(enrolled.href.includes(foreignId), false);
  });
});

describe("Class roster — search", () => {
  it("D: matches legal name, preferred name, and student number", () => {
    const row = rosterStudent(0, {
      firstName: "Wei",
      lastName: "Chen",
      preferredName: "Ada",
      studentNumber: "STU-204",
      displayName: "Ada",
    });
    assert.equal(matchesClassRosterSearch(row.searchText, "ada"), true);
    assert.equal(matchesClassRosterSearch(row.searchText, "chen"), true);
    assert.equal(matchesClassRosterSearch(row.searchText, "wei"), true);
    assert.equal(matchesClassRosterSearch(row.searchText, "stu-204"), true);
    assert.equal(matchesClassRosterSearch(row.searchText, "nobody"), false);
  });
});

describe("Class roster — preferred name", () => {
  it("E: preferred name wins; legal name is the fallback", () => {
    assert.equal(
      teacherStudentDisplayName({
        preferredName: "Agnes Z",
        firstName: "Agnes",
        lastName: "Zhou",
      }),
      "Agnes Z",
    );
    assert.equal(
      teacherStudentDisplayName({
        preferredName: "  ",
        firstName: "Aden",
        lastName: "Garcia",
      }),
      "Aden Garcia",
    );
    assert.equal(
      teacherStudentDisplayName({
        preferredName: null,
        firstName: "Aden",
        lastName: "Garcia",
      }),
      "Aden Garcia",
    );
  });
});

describe("Class roster — support summary", () => {
  it("F: shows Follow-up only when Home/Overview check-in would surface the student", () => {
    assert.equal(rosterSupportLabel(null), "—");
    assert.equal(
      rosterSupportLabel(
        pickCheckInReason({
          attendanceConcern: true,
          missingWork: false,
          academicRisk: false,
          behaviorConcern: false,
          followUpDue: false,
          openPlan: false,
        }),
      ),
      "Follow-up",
    );
    assert.equal(
      rosterSupportLabel(
        pickCheckInReason({
          attendanceConcern: false,
          missingWork: false,
          academicRisk: false,
          behaviorConcern: false,
          followUpDue: false,
          openPlan: false,
        }),
      ),
      "—",
    );
    assert.equal(rosterSupportLabel("attendance"), "Follow-up");
    assert.equal(rosterSupportLabel("missing_work"), "Follow-up");
    assert.equal(rosterSupportLabel("academic"), "Follow-up");
    assert.equal(rosterSupportLabel("plan"), "Follow-up");
  });
});

describe("Class roster — records summary", () => {
  it("G: stays quiet when workflows are not in play", () => {
    const quiet = summarizeRosterStudentRecords({
      transitionRelevant: false,
      transitionSubmitted: false,
      reportingRelevant: false,
      reportComplete: false,
    });
    assert.equal(quiet.label, "—");
    assert.equal(quiet.remaining, 0);
    assert.equal(quiet.relevant, false);
  });

  it("G: reports remaining only for relevant workflows", () => {
    assert.equal(
      summarizeRosterStudentRecords({
        transitionRelevant: true,
        transitionSubmitted: true,
        reportingRelevant: true,
        reportComplete: true,
      }).label,
      "Up to date",
    );
    assert.equal(
      summarizeRosterStudentRecords({
        transitionRelevant: true,
        transitionSubmitted: false,
        reportingRelevant: true,
        reportComplete: true,
      }).label,
      "1 remaining",
    );
    assert.equal(
      summarizeRosterStudentRecords({
        transitionRelevant: true,
        transitionSubmitted: false,
        reportingRelevant: true,
        reportComplete: false,
      }).label,
      "Not started",
    );
    assert.equal(
      summarizeRosterStudentRecords({
        transitionRelevant: false,
        transitionSubmitted: false,
        reportingRelevant: true,
        reportComplete: false,
      }).label,
      "Not started",
    );
    assert.equal(
      summarizeRosterStudentRecords({
        transitionRelevant: true,
        transitionSubmitted: true,
        reportingRelevant: false,
        reportComplete: false,
      }).label,
      "Up to date",
    );
  });
});

describe("Class roster — action wall and filters", () => {
  it("H: has no repeated Overview / Academics / Transition / Report card actions", () => {
    const labels = CLASS_ROSTER_FILTERS.map((item) => item.label).join(" ");
    assert.equal(/Overview|Academics|Transition|Report card|Records remaining/.test(labels), false);
  });

  it("optional filters only appear when support signals exist", () => {
    const quiet = [rosterStudent(0), rosterStudent(1)];
    assert.equal(classRosterFiltersUseful(quiet), false);
    assert.equal(
      classRosterFiltersUseful([rosterStudent(0, { needsSupport: true })]),
      true,
    );
    const filtered = filterClassRoster(
      [
        rosterStudent(0, { needsSupport: true }),
        rosterStudent(1),
        rosterStudent(2),
      ],
      { query: "", filter: "support" },
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.needsSupport, true);
    assert.deepEqual(
      CLASS_ROSTER_FILTERS.map((item) => item.id),
      ["all", "support"],
    );
  });
});

describe("Class roster — enrollment controls", () => {
  it("I: keeps Add / Bulk Add off the teacher roster", () => {
    assert.equal(classRosterEnrollmentVisible("teacher"), false);
    assert.equal(classRosterEnrollmentVisible("admin"), true);
    assert.equal(classRosterEnrollmentVisible("principal"), true);
    assert.equal(classRosterEnrollmentVisible("vice_principal"), true);
    assert.equal(classRosterEnrollmentVisible("registrar"), false);
  });
});

describe("Class roster — mobile scan helpers", () => {
  it("J: hides the number column when no student numbers exist", () => {
    assert.equal(
      classRosterHasStudentNumbers([
        { studentNumber: null },
        { studentNumber: "  " },
      ]),
      false,
    );
    assert.equal(
      classRosterHasStudentNumbers([{ studentNumber: "NS-01" }]),
      true,
    );
  });
});
