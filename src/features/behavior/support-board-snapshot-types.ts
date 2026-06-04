/** Serializable per-student data for the support board (server → client). */

export type SupportBoardStudentSnapshot = {
  /** Running grade for current report term, e.g. "78% · B" — empty when no countable scores. */
  gradeLine: string | null;
  /** True when some categories have scores but not all (matches gradebook `isPartial`). */
  gradePartial: boolean;
  /** Attendance % for the class school year's current term, or null when nothing marked. */
  attendancePercent: number | null;
  /** Matches attendance concern rules used elsewhere (`hasAttendanceConcernMetrics`). */
  attendanceAtRisk: boolean;
  /** Days with an attendance mark in range (for tooltips). */
  attendanceMarkedDays: number;
  /** Parent communication / contact moments this term in this class. */
  parentContactsThisTerm: number;
  /** Most recent parent moment `behavior_date` (ISO date) in this class & term, if any. */
  parentLastBehaviorDate: string | null;
  /** Latest support moment in this class (any type). */
  lastMoment: null | {
    preview: string;
    /** ISO timestamp for relative display. */
    atIso: string;
  };
};

export function emptySupportBoardStudentSnapshot(): SupportBoardStudentSnapshot {
  return {
    gradeLine: null,
    gradePartial: false,
    attendancePercent: null,
    attendanceAtRisk: false,
    attendanceMarkedDays: 0,
    parentContactsThisTerm: 0,
    parentLastBehaviorDate: null,
    lastMoment: null,
  };
}
