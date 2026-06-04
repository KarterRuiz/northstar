import { maxWeeklyAbsencesInRange } from "@/features/attendance/attendance-concerns";
import {
  getAttendanceRiskTier,
  type AttendanceRiskTier,
} from "@/features/attendance/attendance-risk-tier";
import {
  attendancePercent,
  statusCountsInRange,
} from "@/features/attendance/attendance-metrics";
import {
  monthRangeContaining,
  weekRangeContaining,
} from "@/features/attendance/attendance-date-utils";

/** Distinct school days with at least one mark in range (class or grade aggregate). */
export const MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL = 5;

/** Classes that meet the weekly day threshold before weekly class rankings run. */
export const MIN_CLASSES_FOR_WEEKLY_COMPARISON = 2;

/** Distinct school days with marks in the calendar month (~two school weeks). */
export const MIN_SCHOOL_DAYS_FOR_MONTHLY_SIGNAL = 10;

/** Grade levels that meet the monthly day threshold before grade rankings run. */
export const MIN_GRADES_FOR_MONTHLY_COMPARISON = 2;

/**
 * Week-over-week attendance % gain required for “most improved class”.
 * Uses the same period-over-period % comparison as `compareAttendanceTrend` in
 * attendance-trend.ts (higher bar than its 2-point “stable” band).
 */
export const MIN_IMPROVEMENT_PCT_POINTS = 3;

const CONCERNING_TIERS = new Set<AttendanceRiskTier>(["at_risk", "chronic_concern"]);
const RECOVERED_TIERS = new Set<AttendanceRiskTier>(["monitor", "healthy"]);

const MAX_RECOVERING_ITEMS = 6;

export type AttendanceRecordSlice = {
  classId: string;
  studentId: string;
  attendanceDate: string;
  status: string;
};

export type ClassMeta = {
  classId: string;
  classLabel: string;
  gradeId: string;
  gradeName: string;
};

export type PositiveClassSignal = {
  classId: string;
  classLabel: string;
  gradeName: string;
  attendancePct: number;
  schoolDaysMarked: number;
};

export type PositiveGradeSignal = {
  gradeId: string;
  gradeName: string;
  attendancePct: number;
  schoolDaysMarked: number;
};

export type MostImprovedClassSignal = PositiveClassSignal & {
  priorAttendancePct: number;
  improvementPp: number;
};

export type RecoveringStudentSignal = {
  studentId: string;
  studentName: string;
  classId: string;
  classLabel: string;
  priorTier: AttendanceRiskTier;
  currentTier: AttendanceRiskTier;
};

export type RecoveringClassSignal = {
  classId: string;
  classLabel: string;
  gradeName: string;
  priorTier: AttendanceRiskTier;
  currentTier: AttendanceRiskTier;
};

export type PositiveAttendanceSignals = {
  hasComparisonData: boolean;
  emptyMessage: string;
  emptyHints: string[];
  weekRange: { start: string; end: string };
  monthRange: { start: string; end: string };
  strongestClassThisWeek: PositiveClassSignal | null;
  strongestGradeThisMonth: PositiveGradeSignal | null;
  mostImprovedClass: MostImprovedClassSignal | null;
  recoveringStudents: RecoveringStudentSignal[];
  recoveringClasses: RecoveringClassSignal[];
};

export const POSITIVE_SIGNALS_EMPTY_MESSAGE =
  "Not enough marked attendance history yet to highlight positive trends for the current filters.";

export function buildPositiveSignalsEmptyHints(args: {
  classCount: number;
  maxWeeklySchoolDays: number;
  maxPriorWeeklySchoolDays: number;
  maxMonthlySchoolDays: number;
  gradeCount: number;
}): string[] {
  const hints: string[] = [];
  if (args.classCount < MIN_CLASSES_FOR_WEEKLY_COMPARISON) {
    hints.push("Needs multiple classes for comparison");
  }
  if (args.maxWeeklySchoolDays < MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL) {
    hints.push(`Needs at least ${MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL} marked school days`);
  }
  if (
    args.maxWeeklySchoolDays < MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL ||
    args.maxPriorWeeklySchoolDays < MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL
  ) {
    hints.push("Needs at least 2 weeks of records");
  }
  if (
    args.gradeCount < MIN_GRADES_FOR_MONTHLY_COMPARISON &&
    args.maxMonthlySchoolDays < MIN_SCHOOL_DAYS_FOR_MONTHLY_SIGNAL
  ) {
    hints.push(
      `Needs at least ${MIN_SCHOOL_DAYS_FOR_MONTHLY_SIGNAL} marked school days this month for grade highlights`,
    );
  }
  return [...new Set(hints)];
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function priorWeekRange(weekStart: string): { start: string; end: string } {
  const [y, m, d] = weekStart.slice(0, 10).split("-").map(Number);
  const monday = new Date(Date.UTC(y!, m! - 1, d!));
  monday.setUTCDate(monday.getUTCDate() - 7);
  const friday = new Date(monday);
  friday.setUTCDate(friday.getUTCDate() + 4);
  return { start: toIso(monday), end: toIso(friday) };
}

export function priorMonthRange(monthStart: string): { start: string; end: string } {
  const [y, m] = monthStart.slice(0, 10).split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m! - 1;
  const prevYear = m === 1 ? y! - 1 : y!;
  return monthRangeContaining(`${prevYear}-${String(prevMonth).padStart(2, "0")}-15`);
}

function distinctSchoolDays(
  records: AttendanceRecordSlice[],
  start: string,
  end: string,
): number {
  const days = new Set<string>();
  for (const row of records) {
    if (row.attendanceDate < start || row.attendanceDate > end) continue;
    days.add(row.attendanceDate);
  }
  return days.size;
}

function classAttendancePct(
  records: AttendanceRecordSlice[],
  classId: string,
  start: string,
  end: string,
): { pct: number | null; schoolDaysMarked: number } {
  const classRows = records
    .filter((r) => r.classId === classId)
    .map((r) => ({ attendanceDate: r.attendanceDate, status: r.status }));
  const schoolDaysMarked = distinctSchoolDays(
    records.filter((r) => r.classId === classId),
    start,
    end,
  );
  const tally = statusCountsInRange(classRows, start, end);
  return { pct: attendancePercent(tally), schoolDaysMarked };
}

function tierForRecordsInRange(
  records: { attendanceDate: string; status: string }[],
  start: string,
  end: string,
): AttendanceRiskTier {
  const tally = statusCountsInRange(records, start, end);
  const weeklyAbsences = maxWeeklyAbsencesInRange(records, start, end);
  return getAttendanceRiskTier({
    termAbsences: tally.absent,
    termTardies: tally.tardy,
    weeklyAbsences,
  });
}

function isRecovering(prior: AttendanceRiskTier, current: AttendanceRiskTier): boolean {
  return CONCERNING_TIERS.has(prior) && RECOVERED_TIERS.has(current);
}

/**
 * Recovery rule: prior calendar week tier was `at_risk` or `chronic_concern` using
 * that week's absence/tardy counts; current week tier is `monitor` or `healthy`.
 * Each week must have at least MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL distinct marked days
 * for that student–class pair.
 */
export function buildPositiveAttendanceSignals(args: {
  anchorDate: string;
  classes: ClassMeta[];
  records: AttendanceRecordSlice[];
  studentNames: Map<string, string>;
  enrollmentKeys: { studentId: string; classId: string }[];
}): PositiveAttendanceSignals {
  const { start: weekStart, end: weekEnd } = weekRangeContaining(args.anchorDate);
  const priorWeek = priorWeekRange(weekStart);
  const { start: monthStart, end: monthEnd } = monthRangeContaining(args.anchorDate);

  const weeklyEligible = args.classes
    .map((c) => {
      const { pct, schoolDaysMarked } = classAttendancePct(
        args.records,
        c.classId,
        weekStart,
        weekEnd,
      );
      return { ...c, pct, schoolDaysMarked };
    })
    .filter(
      (c) =>
        c.pct != null && c.schoolDaysMarked >= MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL,
    );

  const strongestClassThisWeek: PositiveClassSignal | null =
    weeklyEligible.length >= MIN_CLASSES_FOR_WEEKLY_COMPARISON
      ? (() => {
          const best = weeklyEligible.reduce((a, b) => (a.pct! > b.pct! ? a : b));
          return {
            classId: best.classId,
            classLabel: best.classLabel,
            gradeName: best.gradeName,
            attendancePct: best.pct!,
            schoolDaysMarked: best.schoolDaysMarked,
          };
        })()
      : null;

  const gradeDays = new Map<string, { gradeName: string; days: Set<string> }>();
  const gradeRecords = new Map<string, { attendanceDate: string; status: string }[]>();

  for (const c of args.classes) {
    const classMonthRows = args.records
      .filter((r) => r.classId === c.classId)
      .map((r) => ({ attendanceDate: r.attendanceDate, status: r.status }));
    const existing = gradeRecords.get(c.gradeId) ?? [];
    gradeRecords.set(c.gradeId, [...existing, ...classMonthRows]);
    const entry = gradeDays.get(c.gradeId) ?? { gradeName: c.gradeName, days: new Set() };
    for (const row of args.records) {
      if (
        row.classId === c.classId &&
        row.attendanceDate >= monthStart &&
        row.attendanceDate <= monthEnd
      ) {
        entry.days.add(row.attendanceDate);
      }
    }
    gradeDays.set(c.gradeId, entry);
  }

  const monthlyGrades = [...gradeDays.entries()]
    .map(([gradeId, { gradeName, days }]) => {
      const rows = gradeRecords.get(gradeId) ?? [];
      const tally = statusCountsInRange(rows, monthStart, monthEnd);
      return {
        gradeId,
        gradeName,
        attendancePct: attendancePercent(tally),
        schoolDaysMarked: days.size,
      };
    })
    .filter(
      (g) =>
        g.attendancePct != null &&
        g.schoolDaysMarked >= MIN_SCHOOL_DAYS_FOR_MONTHLY_SIGNAL,
    );

  const strongestGradeThisMonth: PositiveGradeSignal | null =
    monthlyGrades.length >= MIN_GRADES_FOR_MONTHLY_COMPARISON
      ? (() => {
          const best = monthlyGrades.reduce((a, b) =>
            a.attendancePct! > b.attendancePct! ? a : b,
          );
          return {
            gradeId: best.gradeId,
            gradeName: best.gradeName,
            attendancePct: best.attendancePct!,
            schoolDaysMarked: best.schoolDaysMarked,
          };
        })()
      : null;

  const improvedCandidates: MostImprovedClassSignal[] = [];
  for (const c of args.classes) {
    const current = classAttendancePct(args.records, c.classId, weekStart, weekEnd);
    const prior = classAttendancePct(
      args.records,
      c.classId,
      priorWeek.start,
      priorWeek.end,
    );
    if (
      current.pct == null ||
      prior.pct == null ||
      current.schoolDaysMarked < MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL ||
      prior.schoolDaysMarked < MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL
    ) {
      continue;
    }
    const improvementPp = current.pct - prior.pct;
    if (improvementPp < MIN_IMPROVEMENT_PCT_POINTS) continue;
    improvedCandidates.push({
      classId: c.classId,
      classLabel: c.classLabel,
      gradeName: c.gradeName,
      attendancePct: current.pct,
      schoolDaysMarked: current.schoolDaysMarked,
      priorAttendancePct: prior.pct,
      improvementPp,
    });
  }

  const mostImprovedClass =
    improvedCandidates.length > 0
      ? improvedCandidates.reduce((best, row) =>
          row.improvementPp > best.improvementPp ? row : best,
        )
      : null;

  const classMetaById = new Map(args.classes.map((c) => [c.classId, c]));
  const recoveringStudents: RecoveringStudentSignal[] = [];
  for (const { studentId, classId } of args.enrollmentKeys) {
    const studentRows = args.records
      .filter((r) => r.studentId === studentId && r.classId === classId)
      .map((r) => ({ attendanceDate: r.attendanceDate, status: r.status }));
    const currentDays = distinctSchoolDays(
      args.records.filter((r) => r.studentId === studentId && r.classId === classId),
      weekStart,
      weekEnd,
    );
    const priorDays = distinctSchoolDays(
      args.records.filter((r) => r.studentId === studentId && r.classId === classId),
      priorWeek.start,
      priorWeek.end,
    );
    if (
      currentDays < MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL ||
      priorDays < MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL
    ) {
      continue;
    }
    const priorTier = tierForRecordsInRange(studentRows, priorWeek.start, priorWeek.end);
    const currentTier = tierForRecordsInRange(studentRows, weekStart, weekEnd);
    if (!isRecovering(priorTier, currentTier)) continue;
    const meta = classMetaById.get(classId);
    recoveringStudents.push({
      studentId,
      studentName: args.studentNames.get(studentId) ?? "—",
      classId,
      classLabel: meta?.classLabel ?? "—",
      priorTier,
      currentTier,
    });
  }
  recoveringStudents.sort((a, b) => a.studentName.localeCompare(b.studentName));

  const recoveringClasses: RecoveringClassSignal[] = [];
  for (const c of args.classes) {
    const classRows = args.records
      .filter((r) => r.classId === c.classId)
      .map((r) => ({ attendanceDate: r.attendanceDate, status: r.status }));
    const currentDays = distinctSchoolDays(
      args.records.filter((r) => r.classId === c.classId),
      weekStart,
      weekEnd,
    );
    const priorDays = distinctSchoolDays(
      args.records.filter((r) => r.classId === c.classId),
      priorWeek.start,
      priorWeek.end,
    );
    if (
      currentDays < MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL ||
      priorDays < MIN_SCHOOL_DAYS_FOR_WEEKLY_SIGNAL
    ) {
      continue;
    }
    const priorTier = tierForRecordsInRange(classRows, priorWeek.start, priorWeek.end);
    const currentTier = tierForRecordsInRange(classRows, weekStart, weekEnd);
    if (!isRecovering(priorTier, currentTier)) continue;
    recoveringClasses.push({
      classId: c.classId,
      classLabel: c.classLabel,
      gradeName: c.gradeName,
      priorTier,
      currentTier,
    });
  }
  recoveringClasses.sort((a, b) => a.classLabel.localeCompare(b.classLabel));

  const hasComparisonData = Boolean(
    strongestClassThisWeek ||
      strongestGradeThisMonth ||
      mostImprovedClass ||
      recoveringStudents.length > 0 ||
      recoveringClasses.length > 0,
  );

  const maxWeeklySchoolDays = Math.max(
    0,
    ...args.classes.map((c) =>
      distinctSchoolDays(
        args.records.filter((r) => r.classId === c.classId),
        weekStart,
        weekEnd,
      ),
    ),
  );
  const maxPriorWeeklySchoolDays = Math.max(
    0,
    ...args.classes.map((c) =>
      distinctSchoolDays(
        args.records.filter((r) => r.classId === c.classId),
        priorWeek.start,
        priorWeek.end,
      ),
    ),
  );
  const maxMonthlySchoolDays = Math.max(0, ...[...gradeDays.values()].map((g) => g.days.size));
  const gradeIds = new Set(args.classes.map((c) => c.gradeId));

  const emptyHints = buildPositiveSignalsEmptyHints({
    classCount: args.classes.length,
    maxWeeklySchoolDays,
    maxPriorWeeklySchoolDays,
    maxMonthlySchoolDays,
    gradeCount: gradeIds.size,
  });

  return {
    hasComparisonData,
    emptyMessage: POSITIVE_SIGNALS_EMPTY_MESSAGE,
    emptyHints,
    weekRange: { start: weekStart, end: weekEnd },
    monthRange: { start: monthStart, end: monthEnd },
    strongestClassThisWeek,
    strongestGradeThisMonth,
    mostImprovedClass,
    recoveringStudents: recoveringStudents.slice(0, MAX_RECOVERING_ITEMS),
    recoveringClasses: recoveringClasses.slice(0, MAX_RECOVERING_ITEMS),
  };
}
