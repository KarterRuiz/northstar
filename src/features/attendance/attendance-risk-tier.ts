import {
  ATTENDANCE_ABSENCE_THRESHOLD,
  ATTENDANCE_TARDY_THRESHOLD,
  HIGH_ABSENCE_THRESHOLD,
  WEEKLY_ABSENCE_THRESHOLD,
  type AttendanceConcernMetrics,
} from "./attendance-concerns";

/** Tardy count at or above this level is chronic concern (term). */
export const CHRONIC_TARDY_THRESHOLD = 8;

/**
 * Risk tiers (evaluate highest matching tier).
 * Counting: only `absent` for absences, only `tardy` for tardies; `excused` does not
 * count toward absence tiers (same as {@link tallyAttendanceConcernMetrics}).
 */
export type AttendanceRiskTier = "healthy" | "monitor" | "at_risk" | "chronic_concern";

export const attendanceRiskTierLabels: Record<AttendanceRiskTier, string> = {
  healthy: "On track",
  monitor: "Monitor",
  at_risk: "At risk",
  chronic_concern: "Chronic concern",
};

export function attendanceRiskTierClassName(tier: AttendanceRiskTier): string {
  switch (tier) {
    case "healthy":
      return "border-border/80 bg-muted/40 text-muted-foreground";
    case "monitor":
      return "border-sky-500/35 bg-sky-500/10 text-sky-900 dark:text-sky-100";
    case "at_risk":
      return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    case "chronic_concern":
      return "border-destructive/40 bg-destructive/10 text-destructive dark:text-destructive";
  }
}

export function getAttendanceRiskTier(metrics: AttendanceConcernMetrics): AttendanceRiskTier {
  if (
    metrics.termAbsences >= HIGH_ABSENCE_THRESHOLD ||
    metrics.termTardies >= CHRONIC_TARDY_THRESHOLD
  ) {
    return "chronic_concern";
  }
  if (
    metrics.termAbsences >= ATTENDANCE_ABSENCE_THRESHOLD ||
    metrics.termTardies >= ATTENDANCE_TARDY_THRESHOLD
  ) {
    return "at_risk";
  }
  if (
    metrics.weeklyAbsences >= WEEKLY_ABSENCE_THRESHOLD ||
    metrics.termAbsences >= WEEKLY_ABSENCE_THRESHOLD
  ) {
    return "monitor";
  }
  return "healthy";
}

export function isElevatedAttendanceRisk(tier: AttendanceRiskTier): boolean {
  return tier === "at_risk" || tier === "chronic_concern";
}

export function getSuggestedAttendanceAction(tier: AttendanceRiskTier): string | null {
  switch (tier) {
    case "monitor":
      return "Monitor next week";
    case "at_risk":
      return "Family check-in";
    case "chronic_concern":
      return "Create attendance intervention";
    case "healthy":
      return null;
  }
}
