export type ParsedRosterRow = {
  line: number;
  firstName: string;
  lastName: string;
};

export type ParseBulkRosterResult =
  | { ok: true; rows: ParsedRosterRow[] }
  | { ok: false; errors: string[] };

const HEADER_RE = /^\s*first\s*name\s*[,|\t]\s*last\s*name\s*$/i;

function splitCsvLine(line: string): string[] {
  return line.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
}

function parseNameLine(line: string, lineNumber: number): ParsedRosterRow | { error: string } {
  const trimmed = line.trim();
  if (!trimmed) {
    return { error: `Line ${lineNumber}: empty row.` };
  }

  if (trimmed.includes(",")) {
    const parts = splitCsvLine(trimmed);
    if (parts.length < 2) {
      return { error: `Line ${lineNumber}: expected "First, Last" with two names.` };
    }
    const firstName = parts[0]!;
    const lastName = parts.slice(1).join(" ");
    if (!firstName || !lastName) {
      return { error: `Line ${lineNumber}: first and last name are required.` };
    }
    return { line: lineNumber, firstName, lastName };
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return {
      error: `Line ${lineNumber}: provide at least a first and last name (or use "First, Last").`,
    };
  }
  if (tokens.length === 2) {
    return { line: lineNumber, firstName: tokens[0]!, lastName: tokens[1]! };
  }
  return {
    line: lineNumber,
    firstName: tokens[0]!,
    lastName: tokens.slice(1).join(" "),
  };
}

/**
 * Parses bulk roster paste: optional CSV header, comma-separated rows, or one name per line.
 */
export function parseBulkRosterPaste(raw: string): ParseBulkRosterResult {
  const lines = raw.split(/\r?\n/);
  const errors: string[] = [];
  const rows: ParsedRosterRow[] = [];

  let startIndex = 0;
  const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmpty >= 0 && HEADER_RE.test(lines[firstNonEmpty]!.trim())) {
    startIndex = firstNonEmpty + 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    const lineNumber = i + 1;
    const parsed = parseNameLine(line, lineNumber);
    if ("error" in parsed) {
      errors.push(parsed.error);
      continue;
    }
    rows.push(parsed);
  }

  if (rows.length === 0 && errors.length === 0) {
    return { ok: false, errors: ["Paste at least one student name."] };
  }
  if (rows.length === 0) {
    return { ok: false, errors };
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, rows };
}
