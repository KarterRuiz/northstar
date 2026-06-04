/** Report-card / gradebook term codes. */
export const SCHOOL_TERMS = ["T1", "T2", "T3", "T4"] as const;

export type SchoolTerm = (typeof SCHOOL_TERMS)[number];

export function isSchoolTerm(value: string): value is SchoolTerm {
  return (SCHOOL_TERMS as readonly string[]).includes(value);
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function addDaysUtc(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Splits a school year into four equal calendar segments and returns the active term.
 */
export function inferCurrentTerm(
  startsOn: string,
  endsOn: string,
  refDate: Date = new Date(),
): SchoolTerm {
  const start = parseIsoDate(startsOn);
  const end = parseIsoDate(endsOn);
  const ref = new Date(
    Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate()),
  );

  if (ref < start) return "T1";
  if (ref > end) return "T4";

  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = ref.getTime() - start.getTime();
  const quarter = Math.min(3, Math.floor((elapsedMs / totalMs) * 4));
  return SCHOOL_TERMS[quarter]!;
}

export function termDateRange(
  startsOn: string,
  endsOn: string,
  term: SchoolTerm,
): { start: string; end: string } {
  const start = parseIsoDate(startsOn);
  const end = parseIsoDate(endsOn);
  const index = SCHOOL_TERMS.indexOf(term);
  const totalDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const quarterDays = Math.floor(totalDays / 4);
  const termStart = addDaysUtc(start, index * quarterDays);
  const termEnd =
    index === 3 ? end : addDaysUtc(start, (index + 1) * quarterDays - 1);
  return { start: toIsoDate(termStart), end: toIsoDate(termEnd) };
}

export function currentTermDateRange(
  startsOn: string,
  endsOn: string,
  refDate?: Date,
): { term: SchoolTerm; start: string; end: string } {
  const term = inferCurrentTerm(startsOn, endsOn, refDate);
  const range = termDateRange(startsOn, endsOn, term);
  return { term, ...range };
}
