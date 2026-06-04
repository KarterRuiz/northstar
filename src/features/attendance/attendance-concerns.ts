import { statusCountsInRange } from "@/features/attendance/attendance-metrics";
import { weekRangeContaining } from "@/features/attendance/attendance-date-utils";
import type { InterventionSeverity } from "@/features/interventions/schema";

/**
 * Attendance concern thresholds (current term unless noted):
 * - **Term absences:** 3+ records with status `absent`
 * - **Term tardies:** 5+ records with status `tardy`
 * - **Weekly absences:** 2+ `absent` records in any calendar week (Mon–Sun) within the term,
 *   including the week containing `refDateIso` (defaults to today)
 *
 * Counting rules:
 * - Only `absent` counts toward absence thresholds (not `excused`, `present`, `tardy`, or `partial`)
 * - Only `tardy` counts toward the tardy threshold
 * - `excused` is treated as attended for attendance % and does **not** count as an absence concern
 * - `partial` is not double-counted as absent
 */
export const ATTENDANCE_ABSENCE_THRESHOLD = 3;
export const ATTENDANCE_TARDY_THRESHOLD = 5;
export const WEEKLY_ABSENCE_THRESHOLD = 2;
export const HIGH_ABSENCE_THRESHOLD = 5;

export type AttendanceConcernRecord = {
  attendanceDate: string;
  status: string;
};

export type AttendanceConcernKind =
  | "term_absences"
  | "term_tardies"
  | "weekly_absences";

export type AttendanceFollowUpText =
  | "Check in with family"
  | "Monitor next week"
  | "Consider attendance intervention";

export type AdminSuggestedAction =
  | "Family check-in"
  | "Monitor attendance"
  | "Create intervention";

export type AttendanceConcernDetail = {
  kinds: AttendanceConcernKind[];
  followUp: AttendanceFollowUpText;
  adminAction: AdminSuggestedAction;
  interventionSeverity: InterventionSeverity;
  interventionTitle: string;
  interventionDescription: string;
};

export type AttendanceConcernMetrics = {
  termAbsences: number;
  termTardies: number;
  weeklyAbsences: number;
};

export function countAbsencesInWeek(
  records: AttendanceConcernRecord[],
  weekStart: string,
  weekEnd: string,
): number {
  let count = 0;
  for (const row of records) {
    if (row.attendanceDate < weekStart || row.attendanceDate > weekEnd) continue;
    if (row.status === "absent") count += 1;
  }
  return count;
}

export function maxWeeklyAbsencesInRange(
  records: AttendanceConcernRecord[],
  rangeStart: string,
  rangeEnd: string,
): number {
  const absencesByWeek = new Map<string, number>();
  for (const row of records) {
    if (row.attendanceDate < rangeStart || row.attendanceDate > rangeEnd) continue;
    if (row.status !== "absent") continue;
    const monday = weekMondayIso(row.attendanceDate);
    absencesByWeek.set(monday, (absencesByWeek.get(monday) ?? 0) + 1);
  }
  return Math.max(0, ...absencesByWeek.values());
}

function weekMondayIso(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date.toISOString().slice(0, 10);
}

/** Term + weekly absence/tardy counts used by every attendance concern surface. */
export function tallyAttendanceConcernMetrics(
  records: AttendanceConcernRecord[],
  termStart: string,
  termEnd: string,
  refDateIso: string = new Date().toISOString().slice(0, 10),
): AttendanceConcernMetrics {
  const termTally = statusCountsInRange(records, termStart, termEnd);
  const { start: weekStart, end: weekEnd } = weekRangeContaining(refDateIso);
  const currentWeekAbsences = countAbsencesInWeek(records, weekStart, weekEnd);
  const maxWeekInTerm = maxWeeklyAbsencesInRange(records, termStart, termEnd);
  return {
    termAbsences: termTally.absent,
    termTardies: termTally.tardy,
    weeklyAbsences: Math.max(currentWeekAbsences, maxWeekInTerm),
  };
}

export function buildAttendanceConcern(
  args: AttendanceConcernMetrics,
): AttendanceConcernDetail | null {
  const kinds: AttendanceConcernKind[] = [];
  if (args.termAbsences >= ATTENDANCE_ABSENCE_THRESHOLD) kinds.push("term_absences");
  if (args.termTardies >= ATTENDANCE_TARDY_THRESHOLD) kinds.push("term_tardies");
  if (args.weeklyAbsences >= WEEKLY_ABSENCE_THRESHOLD) {
    kinds.push("weekly_absences");
  }
  if (kinds.length === 0) return null;

  const followUp = pickFollowUp(kinds, args.termAbsences);
  const adminAction = pickAdminAction(kinds, args.termAbsences);
  const interventionSeverity: InterventionSeverity =
    args.termAbsences >= HIGH_ABSENCE_THRESHOLD ? "high" : "medium";

  const title =
    args.termAbsences >= HIGH_ABSENCE_THRESHOLD
      ? "Repeated absence concern"
      : "Attendance check-in";

  const description = [
    args.termAbsences >= ATTENDANCE_ABSENCE_THRESHOLD
      ? `${args.termAbsences} absences this term.`
      : null,
    args.termTardies >= ATTENDANCE_TARDY_THRESHOLD
      ? `${args.termTardies} tardies this term.`
      : null,
    args.weeklyAbsences >= WEEKLY_ABSENCE_THRESHOLD
      ? `${args.weeklyAbsences} absences in a recent week.`
      : null,
    `Recommended: ${followUp}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    kinds,
    followUp,
    adminAction,
    interventionSeverity,
    interventionTitle: title,
    interventionDescription: description,
  };
}

export function evaluateAttendanceConcernFromRecords(
  records: AttendanceConcernRecord[],
  termStart: string,
  termEnd: string,
  refDateIso?: string,
): AttendanceConcernDetail | null {
  return buildAttendanceConcern(
    tallyAttendanceConcernMetrics(records, termStart, termEnd, refDateIso),
  );
}

export function hasAttendanceConcernMetrics(
  metrics: AttendanceConcernMetrics,
): boolean {
  return buildAttendanceConcern(metrics) != null;
}

function pickFollowUp(
  kinds: AttendanceConcernKind[],
  termAbsences: number,
): AttendanceFollowUpText {
  if (termAbsences >= HIGH_ABSENCE_THRESHOLD) return "Consider attendance intervention";
  if (kinds.includes("weekly_absences")) return "Monitor next week";
  if (kinds.includes("term_tardies") && !kinds.includes("term_absences")) {
    return "Monitor next week";
  }
  return "Check in with family";
}

function pickAdminAction(
  kinds: AttendanceConcernKind[],
  termAbsences: number,
): AdminSuggestedAction {
  if (termAbsences >= HIGH_ABSENCE_THRESHOLD) return "Create intervention";
  if (kinds.includes("weekly_absences")) return "Monitor attendance";
  return "Family check-in";
}

/** @deprecated Prefer {@link hasAttendanceConcernMetrics} with {@link tallyAttendanceConcernMetrics}. */
export function hasAttendanceConcern(args: AttendanceConcernMetrics): boolean {
  return buildAttendanceConcern(args) != null;
}

export {
  attendanceRiskTierClassName,
  attendanceRiskTierLabels,
  getAttendanceRiskTier,
  getSuggestedAttendanceAction,
  isElevatedAttendanceRisk,
  type AttendanceRiskTier,
} from "./attendance-risk-tier";
