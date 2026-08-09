/** Normalize school year labels so hyphen / dash variants collide as one key. */
export function normalizeSchoolYearLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\-–—]+/g, "-");
}

/** Prefer en dash for display (matches seed / admin-friendly labels). */
export function canonicalizeSchoolYearLabel(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\-–—]+/g, "–");
}

/** Format a DATE (YYYY-MM-DD) without timezone shift. */
export function formatSchoolYearDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatSchoolYearRange(startsOn: string, endsOn: string): string {
  return `${formatSchoolYearDate(startsOn)} – ${formatSchoolYearDate(endsOn)}`;
}
