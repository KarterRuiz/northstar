import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";

import {
  autoMapColumns,
  autoMapColumnsDetailed,
  materializeRowsFromMatrix,
} from "./auto-map-columns";
import {
  chooseRosterSheet,
  detectHeaderRow,
} from "./detect-roster-structure";
import { normalizeHeaderKey } from "./field-catalog";
import {
  findClassByLabel,
  normalizeClassKey,
} from "./match-helpers";
import { parseRosterBuffer } from "./parse-roster-file";
import type { RosterContextClass } from "./types";

function workbookBuffer(
  sheets: { name: string; rows: (string | number)[][] }[],
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as number[];
  return new Uint8Array(out).buffer;
}

function csvBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

const sampleClass = (label: string): RosterContextClass => ({
  id: "c1",
  name: label.includes("-") ? label.split("-")[0]! : label,
  section: label.includes("-") ? label.split("-").slice(1).join("-") : null,
  schoolYearId: "y1",
  gradeLevelId: "g1",
  gradeName: "Grade 1",
  gradeCode: "G1",
  label,
  isActive: true,
});

describe("normalizeHeaderKey", () => {
  it("D: normalizes capitalization, punctuation, underscores, hyphens, BOM", () => {
    assert.equal(normalizeHeaderKey("Student ID"), "student id");
    assert.equal(normalizeHeaderKey("student_id"), "student id");
    assert.equal(normalizeHeaderKey("Student-ID"), "student id");
    assert.equal(normalizeHeaderKey("STUDENT ID"), "student id");
    assert.equal(normalizeHeaderKey("\uFEFFFirst Name"), "first name");
    assert.equal(normalizeHeaderKey("First\nName"), "first name");
  });
});

describe("auto-mapping aliases", () => {
  it("A: maps standard row-1 style headers", () => {
    const mapping = autoMapColumns([
      "First Name",
      "Last Name",
      "Class",
      "Student Number",
      "Grade",
    ]);
    assert.equal(mapping.first_name, "First Name");
    assert.equal(mapping.last_name, "Last Name");
    assert.equal(mapping.class, "Class");
    assert.equal(mapping.student_number, "Student Number");
    assert.equal(mapping.grade, "Grade");
  });

  it("D/E: Student ID and Homeroom map correctly", () => {
    const mapping = autoMapColumns(["STUDENT ID", "Homeroom", "Given Name", "Family Name"]);
    assert.equal(mapping.student_number, "STUDENT ID");
    assert.equal(mapping.class, "Homeroom");
    assert.equal(mapping.first_name, "Given Name");
    assert.equal(mapping.last_name, "Family Name");
  });

  it("F: English Name maps to english_name, not first/last", () => {
    const mapping = autoMapColumns(["English Name", "Chinese Name", "Class"]);
    assert.equal(mapping.english_name, "English Name");
    assert.equal(mapping.chinese_name, "Chinese Name");
    assert.equal(mapping.first_name, null);
    assert.equal(mapping.last_name, null);
  });

  it("G: unknown headers stay unmapped", () => {
    const mapping = autoMapColumns(["Favorite Color", "Shoe Size", "Notes"]);
    assert.equal(mapping.first_name, null);
    assert.equal(mapping.last_name, null);
    assert.equal(mapping.class, null);
  });

  it("K: ambiguous Name alone is not auto-mapped to first/last", () => {
    const detailed = autoMapColumnsDetailed(["Name", "Class", "Grade"]);
    assert.equal(detailed.mapping.first_name, null);
    assert.equal(detailed.mapping.last_name, null);
    assert.equal(detailed.mapping.class, "Class");
    assert.ok(detailed.ambiguousHeaders.includes("Name"));
  });

  it("supports bilingual aliases", () => {
    const mapping = autoMapColumns(["名", "姓", "学号", "班级", "英文名"]);
    assert.equal(mapping.first_name, "名");
    assert.equal(mapping.last_name, "姓");
    assert.equal(mapping.student_number, "学号");
    assert.equal(mapping.class, "班级");
    assert.equal(mapping.english_name, "英文名");
  });
});

describe("header row detection", () => {
  it("A: chooses row 1 when headers are already there", () => {
    const matrix = [
      ["First Name", "Last Name", "Class"],
      ["Ada", "Lovelace", "ECG1-1"],
      ["Alan", "Turing", "ECG1-1"],
    ];
    const detection = detectHeaderRow(matrix);
    assert.equal(detection.headerRowIndex, 0);
    assert.notEqual(detection.confidence, "low");
  });

  it("B: skips title rows and finds real headers", () => {
    const matrix = [
      ["Grade sheets — Spring 2026"],
      [""],
      ["First Name", "Last Name", "Homeroom", "Student ID"],
      ["Ada", "Lovelace", "ECG1-1", "1001"],
      ["Alan", "Turing", "ECG1-2", "1002"],
    ];
    const detection = detectHeaderRow(matrix);
    assert.equal(detection.headerRowIndex, 2);
    assert.ok(detection.candidates[0]!.aliasHits >= 3);
  });

  it("C: skips blank leading rows", () => {
    const matrix = [
      ["", "", ""],
      ["", "", ""],
      ["First Name", "Last Name", "Class"],
      ["Grace", "Hopper", "ECG1-1"],
    ];
    const detection = detectHeaderRow(matrix);
    assert.equal(detection.headerRowIndex, 2);
  });
});

describe("parseRosterBuffer", () => {
  it("B/J: xlsx with title rows auto-maps required fields", () => {
    const buffer = workbookBuffer([
      {
        name: "Roster",
        rows: [
          ["NorthStar Primary — Grade sheets"],
          ["School Year 2025-2026"],
          ["First Name", "Last Name", "Class", "Student ID"],
          ["Ada", "Lovelace", "ECG1-1", "1001"],
          ["Alan", "Turing", "ECG1-1", "1002"],
        ],
      },
    ]);
    const parsed = parseRosterBuffer(buffer, "Grade sheets.xlsx");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.data.headerRowNumber, 3);
    assert.equal(parsed.data.rows.length, 2);
    const mapping = autoMapColumns(parsed.data.headers);
    assert.equal(mapping.first_name, "First Name");
    assert.equal(mapping.last_name, "Last Name");
    assert.equal(mapping.class, "Class");
    assert.equal(mapping.student_number, "Student ID");
  });

  it("I: csv parses and auto-maps", () => {
    const parsed = parseRosterBuffer(
      csvBuffer("First Name,Last Name,Homeroom\nAda,Lovelace,ECG1-1\n"),
      "roster.csv",
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.data.format, "csv");
    const mapping = autoMapColumns(parsed.data.headers);
    assert.equal(mapping.first_name, "First Name");
    assert.equal(mapping.class, "Homeroom");
  });

  it("H: multi-sheet prefers roster-like sheet when confident", () => {
    const buffer = workbookBuffer([
      {
        name: "Instructions",
        rows: [["Read me"], ["Do not import this sheet"]],
      },
      {
        name: "Student Roster",
        rows: [
          ["First Name", "Last Name", "Class"],
          ["Ada", "Lovelace", "ECG1-1"],
          ["Alan", "Turing", "ECG1-2"],
        ],
      },
      {
        name: "Summary",
        rows: [["Total", 2]],
      },
    ]);
    const parsed = parseRosterBuffer(buffer, "multi.xlsx");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.data.sheetName, "Student Roster");
    assert.equal(parsed.data.needsSheetSelection, false);
    const mapping = autoMapColumns(parsed.data.headers);
    assert.equal(mapping.first_name, "First Name");
  });

  it("H: ambiguous multi-sheet asks for selection", () => {
    const sheets = [
      {
        name: "Sheet1",
        matrix: [
          ["A", "B", "C"],
          ["1", "2", "3"],
        ],
      },
      {
        name: "Sheet2",
        matrix: [
          ["X", "Y", "Z"],
          ["4", "5", "6"],
        ],
      },
    ];
    const choice = chooseRosterSheet(sheets);
    assert.equal(choice.needsSelection, true);
  });
});

describe("class matching", () => {
  it("normalizes ECG1-1 variants", () => {
    assert.equal(normalizeClassKey("ECG1-1"), "ecg1-1");
    assert.equal(normalizeClassKey("ECG1 - 1"), "ecg1-1");
    assert.equal(normalizeClassKey("ecg1-1"), "ecg1-1");
  });

  it("finds class across spacing variants without auto-creating", () => {
    const classes = [sampleClass("ECG1-1")];
    // sampleClass splits on first hyphen → name ECG1, section 1
    const matched = findClassByLabel(classes, "ECG1 - 1", null, "y1");
    assert.ok(matched);
    assert.equal(matched?.id, "c1");

    const missing = findClassByLabel(classes, "ECG9-9", null, "y1");
    assert.equal(missing, null);
  });
});

describe("materializeRowsFromMatrix", () => {
  it("rebuilds rows from a chosen header index", () => {
    const matrix = [
      ["Title"],
      ["First Name", "Last Name", "Class"],
      ["Ada", "Lovelace", "ECG1-1"],
    ];
    const { headers, rows } = materializeRowsFromMatrix(matrix, 1);
    assert.deepEqual(headers, ["First Name", "Last Name", "Class"]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!["First Name"], "Ada");
  });
});
