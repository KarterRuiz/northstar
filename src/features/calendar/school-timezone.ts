import {
  MONTH_NAMES,
  SCHOOL_TIMEZONE,
  SCHOOL_UTC_OFFSET,
} from "./constants";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

export function isIsoTime(value: string): boolean {
  if (!ISO_TIME.test(value)) return false;
  const [h, min] = value.split(":").map(Number);
  return h !== undefined && min !== undefined && h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

/** Today’s school calendar date in Asia/Shanghai (YYYY-MM-DD). */
export function schoolTodayIso(now: Date = new Date()): string {
  return schoolDateIsoFromInstant(now);
}

export function schoolDateIsoFromInstant(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function schoolTimeFromInstant(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function schoolMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function schoolMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const month = MONTH_NAMES[(m ?? 1) - 1] ?? "January";
  return `${month} ${y}`;
}

/** Inclusive all-day start instant for a Shanghai calendar date. */
export function schoolAllDayStartIso(isoDate: string): string {
  return `${isoDate}T00:00:00.000${SCHOOL_UTC_OFFSET}`;
}

/** Inclusive all-day end instant for a Shanghai calendar date. */
export function schoolAllDayEndIso(isoDate: string): string {
  return `${isoDate}T23:59:59.999${SCHOOL_UTC_OFFSET}`;
}

export function schoolTimedInstantIso(isoDate: string, time: string): string {
  return `${isoDate}T${time}:00${SCHOOL_UTC_OFFSET}`;
}

export function addSchoolDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function compareIsoDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxIsoDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export function formatSchoolWeekdayLong(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

export function formatSchoolDayHeading(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatSchoolShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatSchoolHomeDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatSchoolMonthYear(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
}

export function formatSchoolTimeLabel(time: string): string {
  const [hRaw, min] = time.split(":").map(Number);
  const h = hRaw ?? 0;
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  if (min) return `${hour12}:${String(min).padStart(2, "0")} ${suffix}`;
  return `${hour12} ${suffix}`;
}

export function parseMonthKey(value: string | undefined, fallbackToday: string): string {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (y && m && m >= 1 && m <= 12) return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
  }
  return schoolMonthKey(fallbackToday);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const index = (y ?? 2026) * 12 + ((m ?? 1) - 1) + delta;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}
