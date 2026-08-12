import {
  buildAliasLookup,
  normalizeHeaderKey,
  REQUIRED_FIELD_IDS,
  type RosterFieldId,
} from "./field-catalog";
import type { HeaderRowCandidate, SheetCandidate } from "./types";

const aliasLookup = buildAliasLookup();

const TITLE_HINTS =
  /^(roster|student\s*list|class\s*list|grade\s*sheet|grade\s*sheets|attendance|name\s*list|school|year|academic\s*year|term|semester|homeroom\s*list)$/i;

const ROSTER_SHEET_HINTS =
  /roster|student|class|grade|homeroom|enrol|enroll|name\s*list|名册|学生|班級|班级/i;

const IGNORE_SHEET_HINTS = /sheet\d*$|pivot|chart|summary|readme|instructions|template|blank/i;

export function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    return value
      .replace(/^\uFEFF/, "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[\r\n]+/g, " ")
      .trim();
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value);
    return String(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function nonEmptyCells(row: unknown[]): string[] {
  return row.map(cellText).filter((c) => c.length > 0);
}

function looksLikePersonName(value: string): boolean {
  const t = value.trim();
  if (!t || t.length > 60) return false;
  if (/^\d{4,}$/.test(t)) return false;
  if (/^(true|false|yes|no|n\/a|null)$/i.test(t)) return false;
  // Prefer values that look like names rather than long sentences / titles.
  if (/\s{2,}/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 5) return false;
  return /[\p{L}]/u.test(t);
}

function looksLikeClassOrGrade(value: string): boolean {
  const t = value.trim();
  if (!t || t.length > 40) return false;
  if (/^(grade|year|g)\s*\d{1,2}$/i.test(t)) return true;
  if (/^[A-Za-z]{1,8}\d{0,2}[\s\-·•]*\d{0,2}[A-Za-z]?$/i.test(t)) return true;
  if (/班级|年級|年级|班/.test(t)) return true;
  return false;
}

function countAliasHits(cells: string[]): {
  hits: number;
  requiredHits: number;
  fields: Set<RosterFieldId>;
} {
  const fields = new Set<RosterFieldId>();
  let hits = 0;
  for (const cell of cells) {
    const key = normalizeHeaderKey(cell);
    if (!key) continue;
    const fieldId = aliasLookup.get(key);
    if (!fieldId) continue;
    if (!fields.has(fieldId)) {
      fields.add(fieldId);
      hits += 1;
    }
  }
  const requiredHits = REQUIRED_FIELD_IDS.filter((id) => fields.has(id)).length;
  return { hits, requiredHits, fields };
}

function isLikelyTitleRow(cells: string[], colCount: number): boolean {
  if (cells.length === 0) return true;
  if (cells.length === 1) {
    const only = cells[0]!;
    const key = normalizeHeaderKey(only);
    if (TITLE_HINTS.test(key) || TITLE_HINTS.test(only)) return true;
    // Single occupied cell is almost never a column header row.
    if (only.length >= 8) return true;
    if (colCount >= 3 && only.length >= 4) return true;
  }
  if (cells.length <= 2 && cells.every((c) => c.length > 28 || TITLE_HINTS.test(c))) {
    return true;
  }
  return false;
}

function scoreHeaderRow(
  matrix: string[][],
  rowIndex: number,
): { score: number; preview: string[]; aliasHits: number; requiredHits: number } {
  const row = matrix[rowIndex] ?? [];
  const cells = nonEmptyCells(row);
  const preview = cells.slice(0, 8);
  if (cells.length < 2) {
    return { score: -100, preview, aliasHits: 0, requiredHits: 0 };
  }

  const { hits, requiredHits } = countAliasHits(cells);
  let score = 0;

  // Multiple non-empty text cells that look like columns.
  score += Math.min(cells.length, 12) * 4;
  score += hits * 18;
  score += requiredHits * 22;

  if (isLikelyTitleRow(cells, row.length)) score -= 40;

  // Prefer rows whose cells are short label-like strings.
  const avgLen =
    cells.reduce((sum, c) => sum + c.length, 0) / Math.max(cells.length, 1);
  if (avgLen <= 18) score += 8;
  if (avgLen > 40) score -= 20;

  // Following rows should look like student data.
  const dataRows = matrix.slice(rowIndex + 1, rowIndex + 6);
  let studentLike = 0;
  let emptyFollowers = 0;
  for (const data of dataRows) {
    const values = nonEmptyCells(data);
    if (values.length === 0) {
      emptyFollowers += 1;
      continue;
    }
    const nameish = values.filter(looksLikePersonName).length;
    const classish = values.filter(looksLikeClassOrGrade).length;
    if (nameish >= 1 && values.length >= 2) studentLike += 1;
    if (classish >= 1) studentLike += 0.5;
    // Penalize if "data" also looks like headers (alias-heavy).
    const dataAliases = countAliasHits(values).hits;
    if (dataAliases >= 2) studentLike -= 1;
  }
  score += studentLike * 10;
  score -= emptyFollowers * 4;

  // Slight preference for earlier rows among ties (after titles).
  score -= rowIndex * 0.5;

  return { score, preview, aliasHits: hits, requiredHits };
}

export function detectHeaderRow(
  matrix: string[][],
  options?: { scanLimit?: number },
): {
  headerRowIndex: number;
  confidence: "high" | "medium" | "low";
  candidates: HeaderRowCandidate[];
  needsSelection: boolean;
} {
  const scanLimit = Math.min(options?.scanLimit ?? 20, matrix.length);
  const scored: HeaderRowCandidate[] = [];

  for (let i = 0; i < scanLimit; i++) {
    const result = scoreHeaderRow(matrix, i);
    scored.push({
      rowNumber: i + 1,
      rowIndex: i,
      preview: result.preview,
      score: result.score,
      aliasHits: result.aliasHits,
      requiredHits: result.requiredHits,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.rowIndex - b.rowIndex);
  const best = scored[0];
  const second = scored[1];

  if (!best || best.score < 8) {
    return {
      headerRowIndex: 0,
      confidence: "low",
      candidates: scored.slice(0, 8),
      needsSelection: true,
    };
  }

  const lead = second ? best.score - second.score : best.score;
  let confidence: "high" | "medium" | "low" = "medium";
  if (best.aliasHits >= 3 || (best.requiredHits >= 2 && best.aliasHits >= 2)) {
    confidence = lead >= 8 || !second || second.aliasHits === 0 ? "high" : "medium";
  } else if (best.aliasHits >= 1 && best.score >= 25) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  // Close race between two strong candidates → ask the admin.
  if (second && lead < 6 && second.aliasHits >= 1 && best.aliasHits >= 1) {
    confidence = "low";
  }

  return {
    headerRowIndex: best.rowIndex,
    confidence,
    candidates: scored.slice(0, 8),
    needsSelection: confidence === "low",
  };
}

export function scoreSheetName(name: string, index: number): number {
  const n = name.trim();
  const key = normalizeHeaderKey(n);
  let score = 0;
  if (ROSTER_SHEET_HINTS.test(n) || ROSTER_SHEET_HINTS.test(key)) score += 30;
  if (IGNORE_SHEET_HINTS.test(key)) score -= 25;
  if (/^sheet\s*\d*$/i.test(n)) score -= 5;
  // Prefer first sheets slightly when names are generic.
  score += Math.max(0, 5 - index);
  return score;
}

export function scoreSheetContent(matrix: string[][]): number {
  const detection = detectHeaderRow(matrix, { scanLimit: 15 });
  const best = detection.candidates[0];
  if (!best) return 0;
  let score = best.score;
  score += best.aliasHits * 5;
  // Reward sheets with enough data rows after the header.
  const dataCount = matrix
    .slice(best.rowIndex + 1)
    .filter((row) => nonEmptyCells(row).length >= 2).length;
  score += Math.min(dataCount, 40);
  return score;
}

export function chooseRosterSheet(
  sheets: { name: string; matrix: string[][] }[],
): {
  sheetName: string;
  confidence: "high" | "medium" | "low";
  needsSelection: boolean;
  candidates: SheetCandidate[];
} {
  if (sheets.length === 0) {
    return {
      sheetName: "",
      confidence: "low",
      needsSelection: true,
      candidates: [],
    };
  }

  const candidates: SheetCandidate[] = sheets.map((sheet, index) => {
    const nameScore = scoreSheetName(sheet.name, index);
    const contentScore = scoreSheetContent(sheet.matrix);
    const score = nameScore + contentScore;
    const nonEmpty = sheet.matrix.filter((r) => nonEmptyCells(r).length > 0).length;
    const previewCells = nonEmptyCells(sheet.matrix[0] ?? []).slice(0, 5);
    return {
      name: sheet.name,
      score,
      rowCount: Math.max(0, nonEmpty - 1),
      preview: previewCells.join(" · ") || sheet.name,
    };
  });

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0]!;
  const second = candidates[1];

  if (sheets.length === 1) {
    return {
      sheetName: best.name,
      confidence: "high",
      needsSelection: false,
      candidates,
    };
  }

  const lead = second ? best.score - second.score : best.score;
  let confidence: "high" | "medium" | "low" = "medium";
  if (lead >= 25 && best.score >= 40) confidence = "high";
  else if (lead >= 12 && best.score >= 25) confidence = "medium";
  else confidence = "low";

  return {
    sheetName: best.name,
    confidence,
    needsSelection: confidence === "low",
    candidates,
  };
}

export function matrixFromSheetRows(
  rawMatrix: (string | number | boolean | null | Date)[][],
): string[][] {
  return rawMatrix.map((row) => row.map((cell) => cellText(cell)));
}
