/** Local calendar date at midnight (no time component). */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Advance by `schoolDays` Mon–Fri days from `from` (weekends skipped). */
export function addSchoolDays(from: Date, schoolDays: number): Date {
  const result = startOfLocalDay(from);
  let added = 0;
  while (added < schoolDays) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) added++;
  }
  return result;
}

export function toIsoDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse `YYYY-MM-DD` (or ISO string prefix) as a local calendar date. */
export function parseIsoDateOnly(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : startOfLocalDay(d);
}

export function compareIsoDates(a: string, b: string): number {
  const da = parseIsoDateOnly(a);
  const db = parseIsoDateOnly(b);
  if (!da || !db) return 0;
  return da.getTime() - db.getTime();
}
