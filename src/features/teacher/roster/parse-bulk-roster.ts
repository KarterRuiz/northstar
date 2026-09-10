export type ParsedRosterRow = {
  line: number;
  firstName: string;
  lastName: string;
  /** School Student Number — required. */
  studentNumber: string;
};

export type ParseBulkRosterResult =
  | { ok: true; rows: ParsedRosterRow[] }
  | { ok: false; errors: string[] };

const HEADER_RE =
  /^\s*student\s*(number|#|id)\s*[,|\t]\s*first\s*name\s*[,|\t]\s*last\s*name/i;

function splitCsvLine(line: string): string[] {
  return line.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
}

function parseNameLine(line: string, lineNumber: number): ParsedRosterRow | { error: string } {
  const trimmed = line.trim();
  if (!trimmed) {
    return { error: `Line ${lineNumber}: empty row.` };
  }

  // Preferred: StudentNumber, First, Last
  if (trimmed.includes(",")) {
    const parts = splitCsvLine(trimmed);
    if (parts.length < 3) {
      return {
        error: `Line ${lineNumber}: expected "Student Number, First, Last".`,
      };
    }
    const studentNumber = parts[0]!;
    const firstName = parts[1]!;
    const lastName = parts.slice(2).join(" ");
    if (!studentNumber) {
      return { error: `Line ${lineNumber}: Student Number is required.` };
    }
    if (!firstName || !lastName) {
      return { error: `Line ${lineNumber}: first and last name are required.` };
    }
    return { line: lineNumber, firstName, lastName, studentNumber };
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) {
    return {
      error: `Line ${lineNumber}: provide Student Number, first name, and last name (or use "Number, First, Last").`,
    };
  }
  return {
    line: lineNumber,
    studentNumber: tokens[0]!,
    firstName: tokens[1]!,
    lastName: tokens.slice(2).join(" "),
  };
}

/**
 * Parses bulk roster paste for teachers.
 * Format: Student Number, First, Last (optional header).
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
    return { ok: false, errors: ["Paste at least one student (Student Number, First, Last)."] };
  }
  if (rows.length === 0) {
    return { ok: false, errors };
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, rows };
}
