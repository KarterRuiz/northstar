import * as XLSX from "xlsx";

import { TEMPLATE_HEADERS } from "./field-catalog";
import type { ParsedRosterFile } from "./types";

const MAX_ROWS = 5000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    // Avoid scientific notation for student numbers.
    if (Number.isInteger(value) && Math.abs(value) < 1e15) {
      return String(value);
    }
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const workbook = XLSX.read(text, { type: "string", raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [] };
  return sheetToRows(sheet);
}

function sheetToRows(sheet: XLSX.WorkSheet): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  });

  if (matrix.length === 0) return { headers: [], rows: [] };

  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((h, i) => {
    const label = cellToString(h);
    return label || `Column ${i + 1}`;
  });

  // Deduplicate headers so mapping stays unambiguous.
  const seen = new Map<string, number>();
  const uniqueHeaders = headers.map((h) => {
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h} (${count + 1})`;
  });

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    const record: Record<string, string> = {};
    let any = false;
    for (let c = 0; c < uniqueHeaders.length; c++) {
      const key = uniqueHeaders[c]!;
      const val = cellToString(line[c]);
      record[key] = val;
      if (val) any = true;
    }
    if (any) rows.push(record);
  }

  return { headers: uniqueHeaders, rows };
}

export function parseRosterBuffer(
  buffer: ArrayBuffer,
  fileName: string,
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
    let headers: string[];
    let rows: Record<string, string>[];

    if (isCsv) {
      const text = new TextDecoder("utf-8").decode(buffer);
      ({ headers, rows } = parseCsv(text));
    } else {
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return { ok: false, message: "The spreadsheet has no sheets." };
      }
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return { ok: false, message: "Could not read the first sheet." };
      }
      ({ headers, rows } = sheetToRows(sheet));
    }

    if (headers.length === 0) {
      return { ok: false, message: "No column headers were found in the file." };
    }
    if (rows.length === 0) {
      return { ok: false, message: "No student rows were found under the header row." };
    }
    if (rows.length > MAX_ROWS) {
      return {
        ok: false,
        message: `This roster has ${rows.length} rows. Import up to ${MAX_ROWS} students at a time.`,
      };
    }

    return {
      ok: true,
      data: {
        headers,
        rows,
        fileName,
        format: isCsv ? "csv" : "xlsx",
      },
    };
  } catch {
    return {
      ok: false,
      message: "Could not read that file. Check that it is a valid CSV or Excel workbook.",
    };
  }
}

export function buildBlankCsvTemplate(): string {
  const header = TEMPLATE_HEADERS.map((h) => `"${h}"`).join(",");
  return `${header}\n`;
}

export function buildBlankXlsxTemplate(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([ [...TEMPLATE_HEADERS] ]);
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

export function buildImportReportCsv(
  summary: {
    added: number;
    updated: number;
    archived: number;
    gradesCreated: number;
    classesCreated: number;
    errors: { rowNumber: number; message: string }[];
  },
): string {
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
