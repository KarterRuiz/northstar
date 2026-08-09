import {
  buildAliasLookup,
  normalizeHeaderKey,
  ROSTER_FIELD_CATALOG,
  type RosterFieldId,
} from "./field-catalog";
import type { ColumnMapping, MappedRosterRow } from "./types";

const aliasLookup = buildAliasLookup();

/**
 * Auto-detect column → field mapping from headers.
 * Each field maps to at most one column; first confident match wins.
 */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedHeaders = new Set<string>();

  for (const field of ROSTER_FIELD_CATALOG) {
    mapping[field.id] = null;
  }

  for (const header of headers) {
    const key = normalizeHeaderKey(header);
    const fieldId = aliasLookup.get(key);
    if (!fieldId) continue;
    if (mapping[fieldId]) continue;
    if (usedHeaders.has(header)) continue;
    mapping[fieldId] = header;
    usedHeaders.add(header);
  }

  return mapping;
}

export function applyColumnMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): MappedRosterRow[] {
  const fieldIds = Object.keys(mapping) as RosterFieldId[];

  return rows.map((raw, index) => {
    const values: Partial<Record<RosterFieldId, string>> = {};
    for (const fieldId of fieldIds) {
      const header = mapping[fieldId];
      if (!header) continue;
      const cell = raw[header]?.trim() ?? "";
      if (cell) values[fieldId] = cell;
    }
    return {
      rowNumber: index + 2, // header is row 1
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
