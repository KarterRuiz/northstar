import {
  ENROLLMENT_STATUSES,
  type EnrollmentStatusForm,
} from "@/features/students/enrollment-constants";
import { normalizeMatchKey } from "@/features/students/roster-import/match-helpers";

import type { BulkAddClassOption, BulkAddRowDraft } from "./types";
import { createEmptyBulkAddRow } from "./validate-bulk-rows";

export type BulkPasteColumn =
  | "firstName"
  | "lastName"
  | "preferredName"
  | "externalId"
  | "class"
  | "enrollmentStatus"
  | "ignore";

export type BulkPasteParsedRow = {
  firstName: string;
  lastName: string;
  preferredName: string;
  externalId: string;
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
  firstName: ["first name", "firstname", "first", "given name", "given"],
  lastName: ["last name", "lastname", "last", "family name", "surname", "family"],
  preferredName: [
    "preferred name",
    "preferred",
    "nickname",
    "english name",
    "display name",
  ],
  externalId: [
    "student number",
    "student id",
    "student_id",
    "external id",
    "external_id",
    "sis id",
    "id number",
  ],
  class: ["class", "homeroom", "classroom", "section", "class name"],
  enrollmentStatus: ["enrollment status", "status", "enrollment"],
  ignore: [],
};

function splitLine(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((c) => c.trim());
  }
  // Lightweight CSV: split on commas outside simple quotes.
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
    if (column === "ignore") continue;
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
    "firstName",
    "lastName",
    "preferredName",
    "externalId",
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
    case "firstName":
      return "First Name";
    case "lastName":
      return "Last Name";
    case "preferredName":
      return "Preferred Name";
    case "externalId":
      return "Student Number";
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
 * Does not write to the database.
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

    // Fallback positional fill when no header and only two columns.
    let firstName = get("firstName");
    let lastName = get("lastName");
    if (!usedHeader && !firstName && !lastName && cells.length >= 2) {
      firstName = (cells[0] ?? "").trim();
      lastName = (cells[1] ?? "").trim();
    } else if (!usedHeader && !firstName && !lastName && cells.length === 1) {
      const tokens = (cells[0] ?? "").trim().split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        firstName = tokens[0]!;
        lastName = tokens.slice(1).join(" ");
      }
    }

    if (!firstName && !lastName && !get("externalId") && !get("class")) {
      continue;
    }

    rows.push({
      firstName,
      lastName,
      preferredName: get("preferredName"),
      externalId: get("externalId"),
      classLabel: get("class"),
      enrollmentStatus: parseStatus(get("enrollmentStatus")),
    });
  }

  if (rows.length === 0) return null;

  const activeCols = columnMap.filter((c) => c !== "ignore");
  const interpretation = usedHeader
    ? `Detected header. Columns: ${activeCols.map(columnLabel).join(" · ") || "none recognized"}.`
    : `No header detected. Assumed order: ${defaultColumnMap(Math.min(6, firstCells.length))
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

/**
 * Fills blank grid rows first, then appends. Counts how many populated rows
 * would be overwritten if paste is forced from the top.
 */
export function planBulkAddPasteApply(args: {
  currentRows: BulkAddRowDraft[];
  paste: BulkPasteParseResult;
  classOptions: BulkAddClassOption[];
  makeKey: () => string;
  maxRows: number;
  forceOverwrite: boolean;
}): ApplyPastePlan {
  const { currentRows, paste, classOptions, makeKey, maxRows, forceOverwrite } =
    args;

  const blankIndexes = currentRows
    .map((row, i) =>
      !row.firstName.trim() &&
      !row.lastName.trim() &&
      !row.preferredName.trim() &&
      !row.externalId.trim() &&
      !row.classId.trim()
        ? i
        : -1,
    )
    .filter((i) => i >= 0);

  let overwriteCount = 0;
  if (forceOverwrite) {
    for (let i = 0; i < Math.min(paste.rows.length, currentRows.length); i++) {
      const row = currentRows[i]!;
      const populated =
        row.firstName.trim() ||
        row.lastName.trim() ||
        row.preferredName.trim() ||
        row.externalId.trim() ||
        row.classId.trim();
      if (populated) overwriteCount += 1;
    }
  } else {
    const capacity = blankIndexes.length + (maxRows - currentRows.length);
    // Overwrite risk only when forcing from top; non-force uses blanks + append.
    if (paste.rows.length > capacity) {
      // Not an overwrite — we'll just truncate to max later.
    }
  }

  const nextRows = currentRows.map((r) => ({ ...r }));
  let pasteIdx = 0;

  const writeAt = (index: number, parsed: (typeof paste.rows)[number]) => {
    const existing = nextRows[index] ?? createEmptyBulkAddRow(makeKey());
    nextRows[index] = {
      ...existing,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      preferredName: parsed.preferredName,
      externalId: parsed.externalId,
      classId: resolveClassId(parsed.classLabel, classOptions),
      enrollmentStatus: parsed.enrollmentStatus,
    };
  };

  if (forceOverwrite) {
    while (pasteIdx < paste.rows.length && pasteIdx < maxRows) {
      if (pasteIdx < nextRows.length) {
        writeAt(pasteIdx, paste.rows[pasteIdx]!);
      } else {
        nextRows.push(createEmptyBulkAddRow(makeKey()));
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
      nextRows.push(createEmptyBulkAddRow(key));
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

/**
 * Preview whether applying paste into blank rows only would leave leftover
 * paste rows that need new rows, and whether a top-down overwrite would hit
 * populated cells.
 */
export function assessBulkAddPasteOverwrite(
  currentRows: BulkAddRowDraft[],
  pasteRowCount: number,
  maxRows: number,
): { wouldOverwriteFromTop: number; blankCapacity: number; canFitWithoutOverwrite: boolean } {
  const blankCount = currentRows.filter(
    (row) =>
      !row.firstName.trim() &&
      !row.lastName.trim() &&
      !row.preferredName.trim() &&
      !row.externalId.trim() &&
      !row.classId.trim(),
  ).length;
  const appendCapacity = Math.max(0, maxRows - currentRows.length);
  const blankCapacity = blankCount + appendCapacity;

  let wouldOverwriteFromTop = 0;
  for (let i = 0; i < Math.min(pasteRowCount, currentRows.length); i++) {
    const row = currentRows[i]!;
    if (
      row.firstName.trim() ||
      row.lastName.trim() ||
      row.preferredName.trim() ||
      row.externalId.trim() ||
      row.classId.trim()
    ) {
      wouldOverwriteFromTop += 1;
    }
  }

  return {
    wouldOverwriteFromTop,
    blankCapacity,
    canFitWithoutOverwrite: pasteRowCount <= blankCapacity,
  };
}
