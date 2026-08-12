import * as XLSX from "xlsx";

import { autoMapColumnsDetailed, materializeRowsFromMatrix } from "./auto-map-columns";
import {
  chooseRosterSheet,
  detectHeaderRow,
  matrixFromSheetRows,
} from "./detect-roster-structure";
import { TEMPLATE_HEADERS } from "./field-catalog";
import type { ParsedRosterFile } from "./types";

const MAX_ROWS = 5000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export type ParseRosterOptions = {
  /** Force a specific workbook sheet (Excel). */
  sheetName?: string | null;
  /** Force a 0-based header row index within the chosen sheet matrix. */
  headerRowIndex?: number | null;
};

function sheetToMatrix(sheet: XLSX.WorkSheet): string[][] {
  const raw = XLSX.utils.sheet_to_json<(string | number | boolean | null | Date)[]>(
    sheet,
    {
      header: 1,
      defval: "",
      blankrows: true,
      raw: false,
    },
  );
  return matrixFromSheetRows(raw);
}

function readWorkbookSheets(
  workbook: XLSX.WorkBook,
): { name: string; matrix: string[][] }[] {
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    return {
      name,
      matrix: sheet ? sheetToMatrix(sheet) : [],
    };
  }).filter((s) => s.matrix.some((row) => row.some((c) => c.trim().length > 0)));
}

function finalizeParsedFile(input: {
  matrix: string[][];
  fileName: string;
  format: "csv" | "xlsx";
  sheetName: string;
  availableSheets: ParsedRosterFile["availableSheets"];
  sheetSelectionConfidence: ParsedRosterFile["sheetSelectionConfidence"];
  needsSheetSelection: boolean;
  headerRowIndex?: number | null;
}): { ok: true; data: ParsedRosterFile } | { ok: false; message: string } {
  if (input.matrix.length === 0) {
    return { ok: false, message: "No column headers were found in the file." };
  }

  const detection = detectHeaderRow(input.matrix);
  const headerRowIndex =
    input.headerRowIndex != null &&
    input.headerRowIndex >= 0 &&
    input.headerRowIndex < input.matrix.length
      ? input.headerRowIndex
      : detection.headerRowIndex;

  const forcedHeader = input.headerRowIndex != null;
  const { headers, rows } = materializeRowsFromMatrix(input.matrix, headerRowIndex);

  if (headers.length === 0) {
    return { ok: false, message: "No column headers were found in the file." };
  }
  if (rows.length === 0) {
    return {
      ok: false,
      message: "No student rows were found under the header row.",
    };
  }
  if (rows.length > MAX_ROWS) {
    return {
      ok: false,
      message: `This roster has ${rows.length} rows. Import up to ${MAX_ROWS} students at a time.`,
    };
  }

  const confidence = forcedHeader ? "high" : detection.confidence;
  const needsHeaderRowSelection = forcedHeader
    ? false
    : detection.needsSelection && !input.needsSheetSelection;

  return {
    ok: true,
    data: {
      headers,
      rows,
      fileName: input.fileName,
      format: input.format,
      matrix: input.matrix,
      headerRowIndex,
      headerRowNumber: headerRowIndex + 1,
      headerDetectionConfidence: confidence,
      headerCandidates: detection.candidates,
      needsHeaderRowSelection,
      sheetName: input.sheetName,
      availableSheets: input.availableSheets,
      sheetSelectionConfidence: input.sheetSelectionConfidence,
      needsSheetSelection: input.needsSheetSelection,
    },
  };
}

export function parseRosterBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  options: ParseRosterOptions = {},
): { ok: true; data: ParsedRosterFile } | { ok: false; message: string } {
  if (buffer.byteLength === 0) {
    return { ok: false, message: "The file is empty." };
  }
  if (buffer.byteLength > MAX_FILE_BYTES) {
    return {
      ok: false,
      message: "That file is too large. Upload a roster under 8 MB.",
    };
  }

  const lower = fileName.toLowerCase();
  const isCsv = lower.endsWith(".csv");
  const isXlsx = lower.endsWith(".xlsx") || lower.endsWith(".xls");

  if (!isCsv && !isXlsx) {
    return {
      ok: false,
      message: "Upload a CSV or Excel (.xlsx) file.",
    };
  }

  try {
    if (isCsv) {
      const text = new TextDecoder("utf-8").decode(buffer);
      const workbook = XLSX.read(text, { type: "string", raw: false });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) return { ok: false, message: "The file has no data." };
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return { ok: false, message: "Could not read the CSV contents." };
      const matrix = sheetToMatrix(sheet);
      return finalizeParsedFile({
        matrix,
        fileName,
        format: "csv",
        sheetName,
        availableSheets: [
          {
            name: sheetName,
            score: 100,
            rowCount: Math.max(0, matrix.length - 1),
            preview: (matrix[0] ?? []).filter(Boolean).slice(0, 5).join(" · ") || sheetName,
          },
        ],
        sheetSelectionConfidence: "high",
        needsSheetSelection: false,
        headerRowIndex: options.headerRowIndex,
      });
    }

    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheets = readWorkbookSheets(workbook);
    if (sheets.length === 0) {
      return { ok: false, message: "The spreadsheet has no sheets." };
    }

    const choice = chooseRosterSheet(sheets);
    const forcedSheet = options.sheetName?.trim() || null;
    const selectedName =
      forcedSheet && sheets.some((s) => s.name === forcedSheet)
        ? forcedSheet
        : choice.sheetName;

    const selected = sheets.find((s) => s.name === selectedName) ?? sheets[0]!;
    const needsSheetSelection =
      Boolean(forcedSheet) ? false : choice.needsSelection && sheets.length > 1;

    return finalizeParsedFile({
      matrix: selected.matrix,
      fileName,
      format: "xlsx",
      sheetName: selected.name,
      availableSheets: choice.candidates,
      sheetSelectionConfidence: forcedSheet ? "high" : choice.confidence,
      needsSheetSelection,
      headerRowIndex: options.headerRowIndex,
    });
  } catch {
    return {
      ok: false,
      message: "Could not read that file. Check that it is a valid CSV or Excel workbook.",
    };
  }
}

/** Rebuild headers/rows after the admin picks a different header row (no re-upload). */
export function reparseWithHeaderRow(
  file: ParsedRosterFile,
  headerRowIndex: number,
): { ok: true; data: ParsedRosterFile; suggestedMapping: ReturnType<typeof autoMapColumnsDetailed> } | { ok: false; message: string } {
  const finalized = finalizeParsedFile({
    matrix: file.matrix,
    fileName: file.fileName,
    format: file.format,
    sheetName: file.sheetName,
    availableSheets: file.availableSheets,
    sheetSelectionConfidence: file.sheetSelectionConfidence,
    needsSheetSelection: false,
    headerRowIndex,
  });
  if (!finalized.ok) return finalized;
  const suggestedMapping = autoMapColumnsDetailed(finalized.data.headers);
  return { ok: true, data: finalized.data, suggestedMapping };
}

export function buildBlankCsvTemplate(): string {
  const header = TEMPLATE_HEADERS.map((h) => `"${h}"`).join(",");
  return `${header}\n`;
}

export function buildBlankXlsxTemplate(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([[...TEMPLATE_HEADERS]]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Roster");
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as number[];
  return new Uint8Array(out);
}

export function buildErrorReportCsv(
  issues: { rowNumber: number; severity: string; message: string; field?: string }[],
): string {
  const lines = ['"Row","Severity","Field","Message"'];
  for (const issue of issues) {
    const field = issue.field ?? "";
    const msg = issue.message.replaceAll('"', '""');
    lines.push(`"${issue.rowNumber}","${issue.severity}","${field}","${msg}"`);
  }
  return `${lines.join("\n")}\n`;
}

export function buildImportReportCsv(summary: {
  added: number;
  updated: number;
  archived: number;
  gradesCreated: number;
  classesCreated: number;
  errors: { rowNumber: number; message: string }[];
}): string {
  const lines = [
    '"Section","Detail"',
    `"Added","${summary.added}"`,
    `"Updated","${summary.updated}"`,
    `"Archived","${summary.archived}"`,
    `"Grades created","${summary.gradesCreated}"`,
    `"Classes created","${summary.classesCreated}"`,
    "",
    '"Row","Error"',
  ];
  for (const err of summary.errors) {
    const msg = err.message.replaceAll('"', '""');
    lines.push(`"${err.rowNumber}","${msg}"`);
  }
  return `${lines.join("\n")}\n`;
}
