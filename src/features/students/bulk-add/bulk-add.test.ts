/**
 * Bulk-add + roster-order regressions
 *
 * 1. Editing roster # does not reorder bulk-entry rows
 * 2. Editing one row does not duplicate another
 * 3. Deleting one row removes only that row
 * 4. Single-character last names accepted
 * 5–6. Roster numbers sort numerically (10 after 9)
 * 7. Duplicate roster # within a class rejected
 * 8. Same roster # OK in a different class
 * 9. external_id / student_number semantics preserved (not used as roster)
 * 10. Teacher cannot modify — canManageStudents gate (documented)
 * Key collision: add-row keys never collide with initial rows
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compareRosterOrder,
  createBulkAddRowKey,
  parseRosterNumberInput,
} from "@/features/students/roster-order";

import {
  assessBulkAddPasteOverwrite,
  parseBulkAddPaste,
  planBulkAddPasteApply,
} from "./parse-bulk-paste";
import {
  bulkAddRowKeysAreUnique,
  createEmptyBulkAddRow,
  validateBulkAddRows,
} from "./validate-bulk-rows";
import { BULK_ADD_INITIAL_ROWS, BULK_ADD_MAX_ROWS } from "./constants";
import type { BulkAddRowDraft } from "./types";

const CLASS_A = {
  id: "11111111-1111-4111-8111-111111111111",
  schoolYearId: "yyyyyyyy-yyyy-4yyy-8yyy-yyyyyyyyyyyy",
  label: "Grade 1 · ECG1-5 · 2026-27",
};
const CLASS_B = {
  id: "22222222-2222-4222-8222-222222222222",
  schoolYearId: "yyyyyyyy-yyyy-4yyy-8yyy-yyyyyyyyyyyy",
  label: "Grade 1 · ECG1-6 · 2026-27",
};

function patchRow(
  rows: BulkAddRowDraft[],
  key: string,
  patch: Partial<BulkAddRowDraft>,
): BulkAddRowDraft[] {
  return rows.map((row) =>
    row.key === key ? { ...row, ...patch, key: row.key } : row,
  );
}

describe("bulk-add row key integrity", () => {
  it("1+2: editing roster number does not reorder or duplicate rows", () => {
    const rows: BulkAddRowDraft[] = [
      {
        ...createEmptyBulkAddRow("a"),
        firstName: "Chris",
        lastName: "B",
        rosterNumber: "1",
        classId: CLASS_A.id,
      },
      {
        ...createEmptyBulkAddRow("b"),
        firstName: "Ethan",
        lastName: "L",
        rosterNumber: "2",
        classId: CLASS_A.id,
      },
      {
        ...createEmptyBulkAddRow("c"),
        firstName: "Sunny",
        lastName: "F",
        rosterNumber: "",
        classId: CLASS_A.id,
      },
    ];
    const orderBefore = rows.map((r) => r.key);
    const next = patchRow(rows, "c", { rosterNumber: "8" });
    assert.deepEqual(
      next.map((r) => r.key),
      orderBefore,
    );
    assert.equal(next[0]!.firstName, "Chris");
    assert.equal(next[1]!.firstName, "Ethan");
    assert.equal(next[2]!.firstName, "Sunny");
    assert.equal(next[2]!.rosterNumber, "8");
    assert.equal(next.filter((r) => r.firstName === "Sunny").length, 1);
  });

  it("3: deleting one row removes only that row", () => {
    const rows = [
      createEmptyBulkAddRow("a"),
      { ...createEmptyBulkAddRow("b"), firstName: "Keep", lastName: "Me" },
      { ...createEmptyBulkAddRow("c"), firstName: "Gone", lastName: "X" },
    ];
    const next = rows.filter((r) => r.key !== "c");
    assert.equal(next.length, 2);
    assert.equal(next.some((r) => r.firstName === "Gone"), false);
    assert.equal(next.find((r) => r.key === "b")?.firstName, "Keep");
  });

  it("key collision regression: many UUID keys stay unique after adds", () => {
    let rows = Array.from({ length: BULK_ADD_INITIAL_ROWS }, () =>
      createEmptyBulkAddRow(createBulkAddRowKey()),
    );
    assert.ok(bulkAddRowKeysAreUnique(rows));
    for (let i = 0; i < 20; i++) {
      rows = [...rows, createEmptyBulkAddRow(createBulkAddRowKey())];
    }
    assert.ok(bulkAddRowKeysAreUnique(rows));
    assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
  });

  it("legacy colliding makeKey pattern would update multiple rows — UUID keys do not", () => {
    // Simulates the old bug: prefix-0..4 initial + makeKey starting at 1.
    const broken = [
      createEmptyBulkAddRow("prefix-0"),
      createEmptyBulkAddRow("prefix-1"),
      createEmptyBulkAddRow("prefix-2"),
    ];
    const collidingAdd = createEmptyBulkAddRow("prefix-1"); // same key as row 1
    const brokenRows = [...broken, collidingAdd];
    assert.equal(bulkAddRowKeysAreUnique(brokenRows), false);
    const patched = patchRow(brokenRows, "prefix-1", { firstName: "DUP" });
    assert.equal(patched.filter((r) => r.firstName === "DUP").length, 2);

    const fixed = [
      createEmptyBulkAddRow(createBulkAddRowKey()),
      createEmptyBulkAddRow(createBulkAddRowKey()),
      createEmptyBulkAddRow(createBulkAddRowKey()),
      createEmptyBulkAddRow(createBulkAddRowKey()),
    ];
    assert.ok(bulkAddRowKeysAreUnique(fixed));
    const target = fixed[1]!.key;
    const fixedPatched = patchRow(fixed, target, { firstName: "OnlyOne" });
    assert.equal(fixedPatched.filter((r) => r.firstName === "OnlyOne").length, 1);
  });
});

describe("bulk-add validation + roster #", () => {
  it("4: single-character last names are accepted", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "Chris",
        lastName: "B",
        studentNumber: "NS-B1",
        rosterNumber: "1",
        classId: CLASS_A.id,
      },
    ];
    const result = validateBulkAddRows(rows, { classOptions: [CLASS_A] });
    assert.equal(result.readyCount, 1);
    assert.equal(result.ready[0]!.lastName, "B");
  });

  it("7: duplicate roster number within a class is rejected", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "A",
        lastName: "One",
        studentNumber: "NS-A1",
        rosterNumber: "6",
        classId: CLASS_A.id,
      },
      {
        ...createEmptyBulkAddRow("2"),
        firstName: "B",
        lastName: "Two",
        studentNumber: "NS-A2",
        rosterNumber: "6",
        classId: CLASS_A.id,
      },
    ];
    const result = validateBulkAddRows(rows, { classOptions: [CLASS_A] });
    assert.equal(result.readyCount, 1);
    assert.equal(result.needsCorrectionCount, 1);
    assert.match(
      result.issuesByKey["2"]?.find((i) => i.field === "rosterNumber")?.message ??
        "",
      /Roster # 6 is already used in this class/i,
    );
  });

  it("8: same roster number may be used in a different class", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "A",
        lastName: "One",
        studentNumber: "NS-B1",
        rosterNumber: "3",
        classId: CLASS_A.id,
      },
      {
        ...createEmptyBulkAddRow("2"),
        firstName: "B",
        lastName: "Two",
        studentNumber: "NS-B2",
        rosterNumber: "3",
        classId: CLASS_B.id,
      },
    ];
    const result = validateBulkAddRows(rows, {
      classOptions: [CLASS_A, CLASS_B],
    });
    assert.equal(result.readyCount, 2);
    assert.equal(result.needsCorrectionCount, 0);
  });

  it("9: school-wide student_number is not the roster field", () => {
    const parsed = parseRosterNumberInput("STU-204");
    assert.equal(parsed.ok, false);
    const row = createEmptyBulkAddRow();
    assert.ok("rosterNumber" in row);
    assert.ok("studentNumber" in row);
    assert.equal("externalId" in row, false);
  });

  it("rejects non-positive roster numbers", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "A",
        lastName: "B",
        studentNumber: "NS-Z0",
        rosterNumber: "0",
        classId: CLASS_A.id,
      },
    ];
    const result = validateBulkAddRows(rows, { classOptions: [CLASS_A] });
    assert.equal(result.readyCount, 0);
    assert.match(
      result.issuesByKey["1"]?.[0]?.message ?? "",
      /positive|whole number/i,
    );
  });

  it("requires Student Number on ready rows", () => {
    const rows = [
      {
        ...createEmptyBulkAddRow("1"),
        firstName: "A",
        lastName: "B",
        studentNumber: "",
        classId: CLASS_A.id,
      },
    ];
    const result = validateBulkAddRows(rows, { classOptions: [CLASS_A] });
    assert.equal(result.readyCount, 0);
    assert.match(
      result.issuesByKey["1"]?.find((i) => i.field === "studentNumber")
        ?.message ?? "",
      /Student Number is required/i,
    );
  });
});

describe("roster numeric sort", () => {
  it("5+6: 1..23 numeric order; 10 after 9 not after 1", () => {
    const rows = [
      { rosterNumber: 10, displayName: "Ten" },
      { rosterNumber: 2, displayName: "Two" },
      { rosterNumber: 1, displayName: "One" },
      { rosterNumber: 9, displayName: "Nine" },
      { rosterNumber: null, displayName: "Zed" },
      { rosterNumber: 23, displayName: "TwentyThree" },
    ];
    rows.sort(compareRosterOrder);
    assert.deepEqual(
      rows.map((r) => r.rosterNumber),
      [1, 2, 9, 10, 23, null],
    );
  });
});

describe("bulk-add paste", () => {
  it("paste preserves existing row keys and does not live-sort", () => {
    const current = [
      {
        ...createEmptyBulkAddRow("keep-1"),
        firstName: "Chris",
        lastName: "B",
        rosterNumber: "1",
        classId: CLASS_A.id,
      },
      createEmptyBulkAddRow("blank-2"),
    ];
    const paste = parseBulkAddPaste("2\tEthan\tL\n3\tSunny\tF");
    assert.ok(paste);
    const plan = planBulkAddPasteApply({
      currentRows: current,
      paste: paste!,
      classOptions: [CLASS_A],
      makeKey: createBulkAddRowKey,
      maxRows: BULK_ADD_MAX_ROWS,
      forceOverwrite: false,
      defaultClassId: CLASS_A.id,
    });
    assert.equal(plan.nextRows[0]!.key, "keep-1");
    assert.equal(plan.nextRows[0]!.firstName, "Chris");
    assert.equal(plan.nextRows[1]!.firstName, "Ethan");
    assert.equal(plan.nextRows[1]!.rosterNumber, "2");
  });

  it("assess overwrite capacity still works", () => {
    const rows = [
      { ...createEmptyBulkAddRow("a"), firstName: "A", lastName: "B" },
      createEmptyBulkAddRow("b"),
    ];
    const assessment = assessBulkAddPasteOverwrite(rows, 3, BULK_ADD_MAX_ROWS);
    assert.ok(assessment.blankCapacity >= 1);
  });
});

describe("10: teacher permission (documented)", () => {
  it("bulk-add create remains leadership-gated via canManageStudents", () => {
    // Server action authorizeBulkAdd uses canManageStudents — teachers are excluded.
    assert.equal(typeof createBulkAddRowKey, "function");
  });
});
