import {
  buildAliasLookup,
  normalizeHeaderKey,
  ROSTER_FIELD_CATALOG,
  type RosterFieldId,
} from "./field-catalog";
import type {
  ColumnMapping,
  ColumnMappingOrigins,
  MappedRosterRow,
} from "./types";

const aliasLookup = buildAliasLookup();

/** Headers that are too ambiguous to auto-map without confirmation. */
const AMBIGUOUS_HEADERS = new Set(
  [
    "name",
    "student",
    "student name",
    "full name",
    "fullname",
    "姓名",
    "学生姓名",
    "學生姓名",
    "id",
    "number",
    "no",
    "year",
  ].map(normalizeHeaderKey),
);

export type AutoMapResult = {
  mapping: ColumnMapping;
  origins: ColumnMappingOrigins;
  ambiguousHeaders: string[];
};

/**
 * Auto-detect column → field mapping from headers.
 * Exact/normalized alias matches only. Ambiguous single-name columns stay unmapped.
 */
export function autoMapColumns(headers: string[]): ColumnMapping {
  return autoMapColumnsDetailed(headers).mapping;
}

export function autoMapColumnsDetailed(headers: string[]): AutoMapResult {
  const mapping: ColumnMapping = {};
  const origins: ColumnMappingOrigins = {};
  const usedHeaders = new Set<string>();
  const ambiguousHeaders: string[] = [];

  for (const field of ROSTER_FIELD_CATALOG) {
    mapping[field.id] = null;
  }

  for (const header of headers) {
    const key = normalizeHeaderKey(header);
    if (!key) continue;

    if (AMBIGUOUS_HEADERS.has(key)) {
      ambiguousHeaders.push(header);
      continue;
    }

    const fieldId = aliasLookup.get(key);
    if (!fieldId) continue;
    if (mapping[fieldId]) continue;
    if (usedHeaders.has(header)) continue;

    mapping[fieldId] = header;
    origins[fieldId] = "auto";
    usedHeaders.add(header);
  }

  return { mapping, origins, ambiguousHeaders };
}

export function applyColumnMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  options?: { headerRowNumber?: number },
): MappedRosterRow[] {
  const fieldIds = Object.keys(mapping) as RosterFieldId[];
  const headerRowNumber = options?.headerRowNumber ?? 1;

  return rows.map((raw, index) => {
    const values: Partial<Record<RosterFieldId, string>> = {};
    for (const fieldId of fieldIds) {
      const header = mapping[fieldId];
      if (!header) continue;
      const cell = raw[header]?.trim() ?? "";
      if (cell) values[fieldId] = cell;
    }
    return {
      rowNumber: headerRowNumber + 1 + index,
      values,
      raw,
    };
  });
}

export function mappingCompleteness(mapping: ColumnMapping): {
  missingRequired: RosterFieldId[];
  mappedCount: number;
} {
  const missingRequired: RosterFieldId[] = [];
  for (const field of ROSTER_FIELD_CATALOG) {
    if (field.required && !mapping[field.id]) {
      missingRequired.push(field.id);
    }
  }
  const mappedCount = ROSTER_FIELD_CATALOG.filter((f) => Boolean(mapping[f.id])).length;
  return { missingRequired, mappedCount };
}

export function materializeRowsFromMatrix(
  matrix: string[][],
  headerRowIndex: number,
): { headers: string[]; rows: Record<string, string>[] } {
  if (headerRowIndex < 0 || headerRowIndex >= matrix.length) {
    return { headers: [], rows: [] };
  }

  const headerRow = matrix[headerRowIndex] ?? [];
  const width = Math.max(
    headerRow.length,
    ...matrix.slice(headerRowIndex).map((r) => r.length),
  );

  const headers = Array.from({ length: width }, (_, i) => {
    const label = (headerRow[i] ?? "").trim();
    return label || `Column ${i + 1}`;
  });

  const seen = new Map<string, number>();
  const uniqueHeaders = headers.map((h) => {
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h} (${count + 1})`;
  });

  const rows: Record<string, string>[] = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    const record: Record<string, string> = {};
    let any = false;
    for (let c = 0; c < uniqueHeaders.length; c++) {
      const key = uniqueHeaders[c]!;
      const val = (line[c] ?? "").trim();
      record[key] = val;
      if (val) any = true;
    }
    if (any) rows.push(record);
  }

  return { headers: uniqueHeaders, rows };
}
