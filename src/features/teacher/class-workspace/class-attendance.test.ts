/**
 * Class workspace Attendance + Gradebook (Pass 3)
 *
 * A. Attendance opens with the current class — no class picker / fallback.
 * B. Roster uses the opened class and official statuses.
 * C. Submission payload keeps existing statuses and default-present drafts.
 * D. Completion matches Teacher Home / Overview (attendanceStatusForClass).
 * E. Gradebook opens on the same class path.
 * F/G. One canonical gradebook route — no forked grade engine.
 * H. Date defaults to school today; school-year label is passed through.
 * I. Unauthorized class IDs stay behind the existing class-context gate.
 * J. Status controls keep compact touch targets.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { attendanceStatuses } from "@/features/attendance/schema";
import { schoolTodayIso } from "@/features/calendar/school-timezone";
import { attendanceStatusForClass } from "@/features/teacher/dashboard/teacher-home-summaries";

import {
  buildClassAttendanceHistory,
  classAttendanceDateHref,
  classAttendanceTallyLine,
  CLASS_ATTENDANCE_STATUS_SHORT,
  defaultClassAttendanceDraft,
  parseClassAttendanceDate,
  tallyClassAttendance,
} from "./class-attendance";
import { attendancePulseLabel } from "./class-workspace-copy";
import {
  classWorkspaceAttendanceHref,
  classWorkspaceGradebookHref,
  classWorkspaceGradebookPickerHref,
  classWorkspacePath,
} from "./constants";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_CLASS_ID = "22222222-2222-4222-8222-222222222222";

describe("Class attendance — A current class is locked", () => {
  it("opens the class attendance tab, not the standalone picker", () => {
    assert.equal(
      classWorkspaceAttendanceHref(CLASS_ID),
      `/dashboard/teacher/classes/${CLASS_ID}/attendance`,
    );
    assert.equal(classWorkspaceAttendanceHref(CLASS_ID).includes("classId="), false);
    assert.notEqual(
      classWorkspaceAttendanceHref(CLASS_ID),
      classWorkspaceAttendanceHref(OTHER_CLASS_ID),
    );
    assert.equal(
      classAttendanceDateHref(CLASS_ID, "2026-08-10"),
      `/dashboard/teacher/classes/${CLASS_ID}/attendance?date=2026-08-10`,
    );
    assert.equal(classAttendanceDateHref(CLASS_ID, "2026-08-10").includes(OTHER_CLASS_ID), false);
  });
});

describe("Class attendance — B roster + official statuses", () => {
  it("uses NorthStar statuses only and tallies saved marks", () => {
    assert.deepEqual([...attendanceStatuses], [
      "present",
      "absent",
      "tardy",
      "excused",
      "partial",
    ]);
    const tally = tallyClassAttendance([
      { status: "present" },
      { status: "present" },
      { status: "absent" },
      { status: "tardy" },
      { status: null },
    ]);
    assert.equal(tally.present, 2);
    assert.equal(tally.absent, 1);
    assert.equal(tally.tardy, 1);
    assert.equal(tally.marked, 4);
    assert.equal(classAttendanceTallyLine(tally), "Present 2 / Absent 1 / Tardy 1");
    assert.equal(classAttendanceTallyLine(tally).includes("Late"), false);
  });
});

describe("Class attendance — C submission rules", () => {
  it("defaults unmarked students to present before save", () => {
    assert.equal(defaultClassAttendanceDraft(null), "present");
    assert.equal(defaultClassAttendanceDraft("absent"), "absent");
    assert.equal(defaultClassAttendanceDraft("excused"), "excused");
  });
});

describe("Class attendance — D completion source of truth", () => {
  it("uses the same helper as Teacher Home and Overview", () => {
    assert.equal(
      attendanceStatusForClass({ studentCount: 31, markedCount: 31 }),
      "complete",
    );
    assert.equal(
      attendanceStatusForClass({ studentCount: 31, markedCount: 30 }),
      "not_submitted",
    );
    assert.equal(attendancePulseLabel("complete"), "Complete");
    assert.equal(attendancePulseLabel("not_submitted"), "Not submitted");

    const history = buildClassAttendanceHistory({
      enrolledCount: 31,
      excludeDate: "2026-08-11",
      records: [
        ...Array.from({ length: 31 }, (_, i) => ({
          attendanceDate: "2026-08-10",
          studentId: `s-${i}`,
        })),
        { attendanceDate: "2026-08-09", studentId: "s-1" },
        { attendanceDate: "2026-08-11", studentId: "s-today" },
      ],
    });
    assert.deepEqual(
      history.map((row) => `${row.dateLabel} — ${row.statusLabel}`),
      ["Aug 10 — Complete", "Aug 9 — Not submitted"],
    );
  });
});

describe("Class gradebook — E/F/G one engine, class already selected", () => {
  it("routes class gradebook to the existing class-scoped gradebook", () => {
    assert.equal(
      classWorkspaceGradebookHref(CLASS_ID),
      classWorkspacePath(CLASS_ID, "gradebook"),
    );
    assert.equal(
      classWorkspaceGradebookHref(CLASS_ID),
      `/dashboard/teacher/classes/${CLASS_ID}/gradebook`,
    );
    assert.equal(classWorkspaceGradebookPickerHref(), "/dashboard/teacher/gradebook");
    assert.notEqual(
      classWorkspaceGradebookHref(CLASS_ID),
      classWorkspaceGradebookPickerHref(),
    );
  });
});

describe("Class attendance — H school date, no resolver copy", () => {
  it("defaults invalid dates to school today and keeps term language out", () => {
    const today = schoolTodayIso();
    assert.equal(parseClassAttendanceDate(null, today), today);
    assert.equal(parseClassAttendanceDate("nope", today), today);
    assert.equal(parseClassAttendanceDate("2026-08-09", today), "2026-08-09");
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(attendancePulseLabel("complete").includes("resolver"), false);
    assert.equal(attendancePulseLabel("complete").includes("school_years"), false);
  });
});

describe("Class workspace — I unauthorized class stays gated", () => {
  it("keeps attendance and gradebook inside the class workspace layout", () => {
    const forged = "99999999-9999-4999-8999-999999999999";
    assert.ok(classWorkspaceAttendanceHref(forged).startsWith("/dashboard/teacher/classes/"));
    assert.ok(classWorkspaceGradebookHref(forged).startsWith("/dashboard/teacher/classes/"));
    assert.equal(classWorkspaceAttendanceHref(forged).includes("/attendance?classId="), false);
  });
});

describe("Class attendance — J compact status controls", () => {
  it("keeps short labels for every official status", () => {
    for (const status of attendanceStatuses) {
      assert.ok(CLASS_ATTENDANCE_STATUS_SHORT[status]);
    }
    assert.equal(CLASS_ATTENDANCE_STATUS_SHORT.tardy, "T");
    assert.equal(CLASS_ATTENDANCE_STATUS_SHORT.partial, "Pd");
  });
});
