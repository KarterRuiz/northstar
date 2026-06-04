/**
 * Attendance trend compares **attendance %** (share of marked days attended) between
 * the selected period and the immediately prior period. Higher % = improving.
 *
 * Stable when the difference is within {@link ATTENDANCE_TREND_STABLE_THRESHOLD_PP}
 * percentage points; null when either period has no marked days.
 */
export const ATTENDANCE_TREND_STABLE_THRESHOLD_PP = 2;

export type AttendanceTrend = "improving" | "stable" | "declining";

export type AttendanceTrendResult = AttendanceTrend | null;

export function compareAttendanceTrend(
  currentPct: number | null,
  previousPct: number | null,
): AttendanceTrendResult {
  if (currentPct == null || previousPct == null) return null;
  const delta = currentPct - previousPct;
  if (Math.abs(delta) <= ATTENDANCE_TREND_STABLE_THRESHOLD_PP) return "stable";
  return delta > 0 ? "improving" : "declining";
}

export const attendanceTrendLabels: Record<AttendanceTrend, string> = {
  improving: "Improving",
  stable: "Stable",
  declining: "Declining",
};

export const attendanceTrendGlyphs: Record<AttendanceTrend, string> = {
  improving: "↑",
  stable: "→",
  declining: "↓",
};
