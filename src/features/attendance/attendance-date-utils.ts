/** Monday-based week containing `isoDate` (YYYY-MM-DD). */
export function weekRangeContaining(isoDate: string): { start: string; end: string } {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() + diffToMonday);
  const friday = new Date(monday);
  friday.setUTCDate(friday.getUTCDate() + 4);
  return { start: toIso(monday), end: toIso(friday) };
}

export function weekdaysInWeek(weekStart: string): string[] {
  const [y, m, d] = weekStart.slice(0, 10).split("-").map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, d!));
  const days: string[] = [];
  for (let i = 0; i < 5; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    days.push(toIso(day));
  }
  return days;
}

export function monthRangeContaining(isoDate: string): { start: string; end: string } {
  const [y, m] = isoDate.slice(0, 10).split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function weekdayShort(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getUTCDay()]!;
}

/** Monday-based week immediately before `weekStart`. */
export function previousWeekRange(weekStart: string): { start: string; end: string } {
  const [y, m, d] = weekStart.slice(0, 10).split("-").map(Number);
  const monday = new Date(Date.UTC(y!, m! - 1, d!));
  monday.setUTCDate(monday.getUTCDate() - 7);
  return weekRangeContaining(toIso(monday));
}

/** Calendar month immediately before the month containing `monthStart`. */
export function previousMonthRange(monthStart: string): { start: string; end: string } {
  const [y, m] = monthStart.slice(0, 7).split("-").map(Number);
  const prevYear = m === 1 ? y! - 1 : y!;
  const prevMonth = m === 1 ? 12 : m! - 1;
  return monthRangeContaining(
    `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`,
  );
}

/** Monday-based school weeks overlapping a calendar month. */
export function schoolWeeksInMonth(isoDate: string): {
  start: string;
  end: string;
  label: string;
}[] {
  const { start: monthStart, end: monthEnd } = monthRangeContaining(isoDate);
  const weeks: { start: string; end: string; label: string }[] = [];
  let cursor = weekRangeContaining(monthStart).start;

  while (cursor <= monthEnd) {
    const { start, end } = weekRangeContaining(cursor);
    const clippedStart = start < monthStart ? monthStart : start;
    const clippedEnd = end > monthEnd ? monthEnd : end;
    if (clippedStart <= clippedEnd) {
      weeks.push({
        start: clippedStart,
        end: clippedEnd,
        label: clippedStart.slice(5).replace("-", "/"),
      });
    }
    const [y, m, d] = end.split("-").map(Number);
    const nextMonday = new Date(Date.UTC(y!, m! - 1, d!));
    nextMonday.setUTCDate(nextMonday.getUTCDate() + 3);
    cursor = toIso(nextMonday);
  }

  return weeks;
}
