import {
  ENROLLMENT_STATUSES,
  type EnrollmentStatusForm,
} from "@/features/students/enrollment-constants";
import { normalizeMatchKey } from "@/features/students/roster-import/match-helpers";

import type { BulkAddClassOption, BulkAddRowDraft } from "./types";
import { createEmptyBulkAddRow } from "./validate-bulk-rows";

export type BulkPasteColumn =
  | "rosterNumber"
  | "studentNumber"
  | "firstName"
  | "lastName"
  | "preferredName"
  | "class"
  | "enrollmentStatus"
  | "ignore";

export type BulkPasteParsedRow = {
  rosterNumber: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  classLabel: string;
  enrollmentStatus: EnrollmentStatusForm;
};

export type BulkPasteParseResult = {
  rows: BulkPasteParsedRow[];
  columnMap: BulkPasteColumn[];
  columnLabels: string[];
  usedHeader: boolean;
  interpretation: string;
};

const HEADER_ALIASES: Record<BulkPasteColumn, string[]> = {
  rosterNumber: [
    "roster #",
    "roster number",
    "roster",
    "roster no",
    "roster_no",
    "class number",
    "class #",
    "seat",
    "seat #",
    "seat number",
    "order",
    "position",
    "#",
  ],
  studentNumber: [
    "student number",
    "student #",
    "student id",
    "student_id",
    "external id",
    "external_id",
    "sis id",
    "id number",
    "学号",
  ],
  firstName: ["first name", "firstname", "first", "given name", "given"],
  lastName: ["last name", "lastname", "last", "family name", "surname", "family"],
  preferredName: [
    "preferred name",
    "preferred",
    "nickname",
    "english name",
    "display name",
  ],
  class: ["class", "homeroom", "classroom", "section", "class name"],
  enrollmentStatus: ["enrollment status", "status", "enrollment"],
  ignore: [],
};

function splitLine(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((c) => c.trim());
  }
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function mapHeaderCell(raw: string): BulkPasteColumn {
  const key = normalizeMatchKey(raw);
  for (const [column, aliases] of Object.entries(HEADER_ALIASES) as [
    BulkPasteColumn,
    string[],
  ][]) {
    if (aliases.some((a) => a === key)) return column;
  }
  return "ignore";
}

function looksLikeHeader(cells: string[]): boolean {
  const mapped = cells.map(mapHeaderCell);
  const named = mapped.filter((c) => c !== "ignore").length;
  return named >= 2 && (mapped.includes("firstName") || mapped.includes("lastName"));
}

function defaultColumnMap(width: number): BulkPasteColumn[] {
  const defaults: BulkPasteColumn[] = [
    "rosterNumber",
    "firstName",
    "lastName",
    "studentNumber",
    "preferredName",
    "class",
    "enrollmentStatus",
  ];
  return Array.from({ length: width }, (_, i) => defaults[i] ?? "ignore");
}

function parseStatus(raw: string): EnrollmentStatusForm {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return (ENROLLMENT_STATUSES as readonly string[]).includes(t)
    ? (t as EnrollmentStatusForm)
    : "active";
}

function columnLabel(col: BulkPasteColumn): string {
  switch (col) {
    case "rosterNumber":
      return "Roster #";
    case "studentNumber":
      return "Student Number";
    case "firstName":
      return "First Name";
    case "lastName":
      return "Last Name";
    case "preferredName":
      return "Preferred Name";
    case "class":
      return "Class";
    case "enrollmentStatus":
      return "Enrollment Status";
    default:
      return "Ignored";
  }
}

/**
 * Parse tab/newline (Excel/Sheets) or simple CSV paste into draft field values.
 * Does not write to the database. Does not live-sort rows.
 * Student Number maps to students.external_id — never to roster_number.
 */
export function parseBulkAddPaste(raw: string): BulkPasteParseResult | null {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return null;

  const firstCells = splitLine(lines[0]!);
  const usedHeader = looksLikeHeader(firstCells);
  const columnMap = usedHeader
    ? firstCells.map(mapHeaderCell)
    : defaultColumnMap(firstCells.length);
  const dataLines = usedHeader ? lines.slice(1) : lines;

  if (dataLines.length === 0) return null;

  const rows: BulkPasteParsedRow[] = [];
  for (const line of dataLines) {
    const cells = splitLine(line);
    const get = (col: BulkPasteColumn): string => {
      const idx = columnMap.indexOf(col);
      if (idx < 0) return "";
      return (cells[idx] ?? "").trim();
    };

    let firstName = get("firstName");
    let lastName = get("lastName");
    if (!usedHeader && !firstName && !lastName && cells.length >= 2) {
      // If first cell is a bare number, treat as roster # + names.
      if (/^\d+$/.test((cells[0] ?? "").trim()) && cells.length >= 3) {
        firstName = (cells[1] ?? "").trim();
        lastName = (cells[2] ?? "").trim();
      } else {
        firstName = (cells[0] ?? "").trim();
        lastName = (cells[1] ?? "").trim();
      }
    } else if (!usedHeader && !firstName && !lastName && cells.length === 1) {
      const tokens = (cells[0] ?? "").trim().split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        firstName = tokens[0]!;
        lastName = tokens.slice(1).join(" ");
      }
    }

    const rosterNumber =
      get("rosterNumber") ||
      (!usedHeader && /^\d+$/.test((cells[0] ?? "").trim())
        ? (cells[0] ?? "").trim()
        : "");

    const studentNumber = get("studentNumber");

    if (!firstName && !lastName && !rosterNumber && !studentNumber && !get("class")) {
      continue;
    }

    rows.push({
      rosterNumber,
      studentNumber,
      firstName,
      lastName,
      preferredName: get("preferredName"),
      classLabel: get("class"),
      enrollmentStatus: parseStatus(get("enrollmentStatus")),
    });
  }

  if (rows.length === 0) return null;

  const activeCols = columnMap.filter((c) => c !== "ignore");
  const interpretation = usedHeader
    ? `Detected header. Columns: ${activeCols.map(columnLabel).join(" · ") || "none recognized"}.`
    : `No header detected. Assumed order: ${defaultColumnMap(Math.min(7, firstCells.length))
        .filter((c) => c !== "ignore")
        .map(columnLabel)
        .join(" · ")}.`;

  return {
    rows,
    columnMap,
    columnLabels: columnMap.map(columnLabel),
    usedHeader,
    interpretation,
  };
}

function resolveClassId(
  classLabel: string,
  classOptions: BulkAddClassOption[],
): string {
  if (!classLabel.trim()) return "";
  const key = normalizeMatchKey(classLabel);
  const compact = key.replace(/\s+/g, "");
  for (const opt of classOptions) {
    const labelKey = normalizeMatchKey(opt.label);
    if (labelKey === key) return opt.id;
    if (labelKey.includes(key) || key.includes(labelKey)) return opt.id;
    const nameOnly = labelKey.split("·").map((p) => p.trim());
    if (nameOnly.some((p) => p === key || p.replace(/\s+/g, "") === compact)) {
      return opt.id;
    }
  }
  return "";
}

export type ApplyPastePlan = {
  nextRows: BulkAddRowDraft[];
  wouldOverwrite: boolean;
  overwriteCount: number;
  pasteRowCount: number;
  interpretation: string;
};

function isRowBlankForPaste(row: BulkAddRowDraft): boolean {
  return (
    !row.firstName.trim() &&
    !row.lastName.trim() &&
    !row.preferredName.trim() &&
    !row.studentNumber.trim() &&
    !row.rosterNumber.trim() &&
    !row.classId.trim()
  );
}

/**
 * Fills blank grid rows first, then appends. Preserves existing row keys.
 * Never live-sorts the grid.
 */
export function planBulkAddPasteApply(args: {
  currentRows: BulkAddRowDraft[];
  paste: BulkPasteParseResult;
  classOptions: BulkAddClassOption[];
  makeKey: () => string;
  maxRows: number;
  forceOverwrite: boolean;
  defaultClassId?: string;
}): ApplyPastePlan {
  const {
    currentRows,
    paste,
    classOptions,
    makeKey,
    maxRows,
    forceOverwrite,
    defaultClassId = "",
  } = args;

  const blankIndexes = currentRows
    .map((row, i) => (isRowBlankForPaste(row) ? i : -1))
    .filter((i) => i >= 0);

  let overwriteCount = 0;
  if (forceOverwrite) {
    for (let i = 0; i < Math.min(paste.rows.length, currentRows.length); i++) {
      const row = currentRows[i]!;
      if (!isRowBlankForPaste(row)) overwriteCount += 1;
    }
  }

  const nextRows = currentRows.map((r) => ({ ...r }));
  let pasteIdx = 0;

  const writeAt = (index: number, parsed: (typeof paste.rows)[number]) => {
    const existing = nextRows[index] ?? createEmptyBulkAddRow(makeKey());
    const resolvedClass =
      resolveClassId(parsed.classLabel, classOptions) ||
      existing.classId ||
      defaultClassId;
    nextRows[index] = {
      ...existing,
      key: existing.key,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      preferredName: parsed.preferredName,
      studentNumber: parsed.studentNumber,
      rosterNumber: parsed.rosterNumber,
      classId: resolvedClass,
      enrollmentStatus: parsed.enrollmentStatus,
    };
  };

  if (forceOverwrite) {
    while (pasteIdx < paste.rows.length && pasteIdx < maxRows) {
      if (pasteIdx < nextRows.length) {
        writeAt(pasteIdx, paste.rows[pasteIdx]!);
      } else {
        nextRows.push(createEmptyBulkAddRow(makeKey(), { classId: defaultClassId }));
        writeAt(pasteIdx, paste.rows[pasteIdx]!);
      }
      pasteIdx += 1;
    }
  } else {
    for (const blankIdx of blankIndexes) {
      if (pasteIdx >= paste.rows.length) break;
      writeAt(blankIdx, paste.rows[pasteIdx]!);
      pasteIdx += 1;
    }
    while (pasteIdx < paste.rows.length && nextRows.length < maxRows) {
      const key = makeKey();
      nextRows.push(createEmptyBulkAddRow(key, { classId: defaultClassId }));
      writeAt(nextRows.length - 1, paste.rows[pasteIdx]!);
      pasteIdx += 1;
    }
  }

  return {
    nextRows,
    wouldOverwrite: forceOverwrite ? overwriteCount > 0 : false,
    overwriteCount,
    pasteRowCount: paste.rows.length,
    interpretation: paste.interpretation,
  };
}

export function assessBulkAddPasteOverwrite(
  currentRows: BulkAddRowDraft[],
  pasteRowCount: number,
  maxRows: number,
): { wouldOverwriteFromTop: number; blankCapacity: number; canFitWithoutOverwrite: boolean } {
  const blankCount = currentRows.filter(isRowBlankForPaste).length;
  const appendCapacity = Math.max(0, maxRows - currentRows.length);
  const blankCapacity = blankCount + appendCapacity;

  let wouldOverwriteFromTop = 0;
  for (let i = 0; i < Math.min(pasteRowCount, currentRows.length); i++) {
    const row = currentRows[i]!;
    if (!isRowBlankForPaste(row)) {
      wouldOverwriteFromTop += 1;
    }
  }

  return {
    wouldOverwriteFromTop,
    blankCapacity,
    canFitWithoutOverwrite: pasteRowCount <= blankCapacity,
  };
}
