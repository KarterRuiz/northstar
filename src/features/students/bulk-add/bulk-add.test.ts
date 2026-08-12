/**
 * Bulk-add expected coverage (Tests A–M)
 *
 * A. Create 2 valid students in one action — validation yields readyCount 2;
 *    create path uses shared createStudentRecord (manual / integration).
 * B. 20-row grid remains responsive — MAX_ROWS=50; Add 5 more grows in batches.
 * C. Missing last name blocks review — row-level error, needsCorrectionCount.
 * D. Invalid / inactive class blocked — classId not in active options.
 * E. Duplicate student number in batch blocked — seenExternal map.
 * F. Duplicate student number vs existing DB blocked — existingExternalIds set.
 * G. Remove / add rows — covered by createEmptyBulkAddRow + grid controls.
 * H. Class determines grade — no grade column; class label includes grade.
 * I. Permissions — page + action gate on canManageStudents (unchanged roles).
 * J. Single-add path unchanged — still /students/new + createStudentAction.
 * K. Roster import unchanged — still /students/import.
 * L. Paste fills blanks without overwrite unless confirmed — parse/plan tests.
 * M. Desktop-first grid usable — sticky header + horizontal scroll container.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assessBulkAddPasteOverwrite,
  parseBulkAddPaste,
  planBulkAddPasteApply,
} from "./parse-bulk-paste";
import {
  createEmptyBulkAddRow,
  validateBulkAddRows,
} from "./validate-bulk-rows";
import { BULK_ADD_INITIAL_ROWS, BULK_ADD_MAX_ROWS } from "./constants";

const CLASS_A = {
  id: "11111111-1111-4111-8111-111111111111",
  schoolYearId: "yyyyyyyy-yyyy-4yyy-8yyy-yyyyyyyyyyyy",
  label: "Grade 3 · Homeroom A · 2025-26",
};
const CLASS_B = {
  id: "22222222-2222-4222-8222-222222222222",
  schoolYearId: "yyyyyyyy-yyyy-4yyy-8yyy-yyyyyyyyyyyy",
  label: "Grade 4 · Homeroom B · 2025-26",
};

describe("bulk-add validation", () => {
  it("A: accepts two valid students", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "Ada",
        lastName: "Lovelace",
        classId: CLASS_A.id,
      },
      {
        ...createEmptyBulkAddRow("2"),
        firstName: "Alan",
        lastName: "Turing",
        classId: CLASS_B.id,
        externalId: "STU-2",
      },
      createEmptyBulkAddRow("3"),
    ];
    const result = validateBulkAddRows(rows, {
      classOptions: [CLASS_A, CLASS_B],
      existingExternalIds: new Set(),
    });
    assert.equal(result.readyCount, 2);
    assert.equal(result.needsCorrectionCount, 0);
    assert.equal(result.skippedBlankCount, 1);
  });

  it("B: documents max row capacity", () => {
    assert.equal(BULK_ADD_INITIAL_ROWS, 5);
    assert.equal(BULK_ADD_MAX_ROWS, 50);
  });

  it("C: missing last name needs correction", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "NoLast",
        classId: CLASS_A.id,
      },
    ];
    const result = validateBulkAddRows(rows, {
      classOptions: [CLASS_A],
      existingExternalIds: new Set(),
    });
    assert.equal(result.readyCount, 0);
    assert.equal(result.needsCorrectionCount, 1);
    assert.match(
      result.issuesByKey["1"]?.[0]?.message ?? "",
      /last name/i,
    );
  });

  it("D: invalid class is blocked", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "A",
        lastName: "B",
        classId: "99999999-9999-4999-8999-999999999999",
      },
    ];
    const result = validateBulkAddRows(rows, {
      classOptions: [CLASS_A],
      existingExternalIds: new Set(),
    });
    assert.equal(result.needsCorrectionCount, 1);
    assert.match(
      result.issuesByKey["1"]?.find((i) => i.field === "classId")?.message ??
        "",
      /inactive|unavailable/i,
    );
  });

  it("E: duplicate student number in batch is blocked", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "A",
        lastName: "One",
        classId: CLASS_A.id,
        externalId: "DUP-1",
      },
      {
        ...createEmptyBulkAddRow("2"),
        firstName: "B",
        lastName: "Two",
        classId: CLASS_B.id,
        externalId: "dup-1",
      },
    ];
    const result = validateBulkAddRows(rows, {
      classOptions: [CLASS_A, CLASS_B],
      existingExternalIds: new Set(),
    });
    assert.equal(result.readyCount, 1);
    assert.equal(result.needsCorrectionCount, 1);
    assert.match(
      result.issuesByKey["2"]?.find((i) => i.field === "externalId")
        ?.message ?? "",
      /duplicated in this batch/i,
    );
  });

  it("F: duplicate vs existing DB is blocked", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "A",
        lastName: "One",
        classId: CLASS_A.id,
        externalId: "EXISTING-9",
      },
    ];
    const result = validateBulkAddRows(rows, {
      classOptions: [CLASS_A],
      existingExternalIds: new Set(["existing-9"]),
    });
    assert.equal(result.readyCount, 0);
    assert.match(
      result.issuesByKey["1"]?.find((i) => i.field === "externalId")
        ?.message ?? "",
      /already used/i,
    );
  });

  it("H: ready row carries class label (grade follows class)", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "A",
        lastName: "B",
        classId: CLASS_A.id,
      },
    ];
    const result = validateBulkAddRows(rows, {
      classOptions: [CLASS_A],
      existingExternalIds: new Set(),
    });
    assert.equal(result.ready[0]?.classLabel, CLASS_A.label);
    assert.match(result.ready[0]?.classLabel ?? "", /Grade 3/);
  });

  it("detects repeated identical rows", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "Same",
        lastName: "Person",
        classId: CLASS_A.id,
      },
      {
        ...createEmptyBulkAddRow("2"),
        firstName: "Same",
        lastName: "Person",
        classId: CLASS_A.id,
      },
    ];
    const result = validateBulkAddRows(rows, {
      classOptions: [CLASS_A],
      existingExternalIds: new Set(),
    });
    assert.equal(result.readyCount, 1);
    assert.equal(result.needsCorrectionCount, 1);
  });
});

describe("bulk-add paste", () => {
  it("L: parses TSV with header and fills blank rows without overwrite", () => {
    const paste = parseBulkAddPaste(
      "First Name\tLast Name\tStudent Number\tClass\nAda\tLovelace\tA1\tHomeroom A\nAlan\tTuring\tA2\tHomeroom B",
    );
    assert.ok(paste);
    assert.equal(paste!.usedHeader, true);
    assert.equal(paste!.rows.length, 2);
    assert.match(paste!.interpretation, /Detected header/i);

    const current = [
      createEmptyBulkAddRow("a"),
      createEmptyBulkAddRow("b"),
      {
        ...createEmptyBulkAddRow("c"),
        firstName: "Keep",
        lastName: "Me",
        classId: CLASS_A.id,
      },
    ];

    const assessment = assessBulkAddPasteOverwrite(current, 2, BULK_ADD_MAX_ROWS);
    assert.equal(assessment.canFitWithoutOverwrite, true);

    const plan = planBulkAddPasteApply({
      currentRows: current,
      paste: paste!,
      classOptions: [CLASS_A, CLASS_B],
      makeKey: () => "new",
      maxRows: BULK_ADD_MAX_ROWS,
      forceOverwrite: false,
    });

    assert.equal(plan.nextRows[0]?.firstName, "Ada");
    assert.equal(plan.nextRows[1]?.firstName, "Alan");
    assert.equal(plan.nextRows[2]?.firstName, "Keep");
  });

  it("L: flags overwrite risk when blank capacity is insufficient", () => {
    const current = [
      {
        ...createEmptyBulkAddRow("a"),
        firstName: "Keep",
        lastName: "One",
        classId: CLASS_A.id,
      },
      {
        ...createEmptyBulkAddRow("b"),
        firstName: "Keep",
        lastName: "Two",
        classId: CLASS_B.id,
      },
    ];
    const assessment = assessBulkAddPasteOverwrite(current, 3, 2);
    assert.equal(assessment.canFitWithoutOverwrite, false);
    assert.equal(assessment.wouldOverwriteFromTop, 2);
  });
});
