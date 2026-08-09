/** Infer display order from names like "Grade 5", "G5", or "5". */
export function inferSortOrderFromName(name: string): number | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  if (/^(k|kindergarten)$/i.test(trimmed)) return 0;

  const gradeMatch = trimmed.match(/^(?:grade|year|g)\s*(\d{1,3})$/i);
  if (gradeMatch) {
    const n = Number.parseInt(gradeMatch[1]!, 10);
    return Number.isFinite(n) ? n : null;
  }

  const bare = trimmed.match(/^(\d{1,3})$/);
  if (bare) {
    const n = Number.parseInt(bare[1]!, 10);
    return Number.isFinite(n) ? n : null;
  }

  const trailing = trimmed.match(/(\d{1,3})\s*$/);
  if (trailing) {
    const n = Number.parseInt(trailing[1]!, 10);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

/** Suggest a short code (e.g. Grade 5 → G5). */
export function inferCodeFromName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (/^(k|kindergarten)$/i.test(trimmed)) return "K";

  const order = inferSortOrderFromName(trimmed);
  if (order === null) return null;
  return `G${order}`;
}

export function normalizeGradeCode(raw: string | null | undefined): string | null {
  const code = String(raw ?? "").trim();
  return code.length > 0 ? code.slice(0, 40) : null;
}

/** Map Postgres unique/FK errors to administrator-facing copy. */
export function gradeLevelDbErrorMessage(message: string, fallback: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("grade_levels_name_unique") || lower.includes("(name)")) {
    return "A grade level with this name already exists. Choose a different name.";
  }
  if (lower.includes("grade_levels_code_lower_uidx") || lower.includes("(lower")) {
    return "A grade level with this code already exists. Choose a different code.";
  }
  if (lower.includes("classes_grade_level_id_fkey") || lower.includes("foreign key")) {
    return "This grade cannot be deleted because school records are attached to it. Archive it instead.";
  }
  // Never surface raw Postgres / schema text to administrators.
  return fallback;
}
