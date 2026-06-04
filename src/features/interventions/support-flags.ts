import {
  ATTENDANCE_ABSENCE_THRESHOLD,
  ATTENDANCE_TARDY_THRESHOLD,
  hasAttendanceConcernMetrics,
  type AttendanceConcernMetrics,
} from "@/features/attendance/attendance-concerns";
import type { BehaviorSeverity, BehaviorType } from "@/features/behavior/schema";
import { BEHAVIOR_CONCERN_TYPES } from "@/features/behavior/schema";

export { ATTENDANCE_ABSENCE_THRESHOLD, ATTENDANCE_TARDY_THRESHOLD };
export const BEHAVIOR_CONCERN_THRESHOLD = 2;
export const POSITIVE_RECOGNITION_LOOKBACK_DAYS = 30;

export type SupportFlagKind =
  | "academic_risk"
  | "missing_work"
  | "enrichment_candidate"
  | "attendance_concern"
  | "behavior_concern"
  | "positive_recognition";

export type SupportFlag = {
  kind: SupportFlagKind;
  label: string;
};

export type AttendanceRecordForFlags = {
  attendanceDate: string;
  status: string;
};

export type BehaviorRecordForFlags = {
  behaviorDate: string;
  behaviorType: BehaviorType | string;
  severity: BehaviorSeverity | string;
};

export function computeAttendanceConcernFlag(
  metrics: AttendanceConcernMetrics,
): SupportFlag | null {
  if (!hasAttendanceConcernMetrics(metrics)) return null;
  return {
    kind: "attendance_concern",
    label: "Attendance concern",
  };
}

export function computeBehaviorConcernFlag(
  concernCount: number,
): SupportFlag | null {
  if (concernCount >= BEHAVIOR_CONCERN_THRESHOLD) {
    return {
      kind: "behavior_concern",
      label: "Support concern",
    };
  }
  return null;
}

export function computePositiveRecognitionFlag(
  hasRecentPositive: boolean,
): SupportFlag | null {
  if (!hasRecentPositive) return null;
  return {
    kind: "positive_recognition",
    label: "Positive recognition",
  };
}

export function countTermAttendance(
  records: AttendanceRecordForFlags[],
  termStart: string,
  termEnd: string,
): { absences: number; tardies: number } {
  let absences = 0;
  let tardies = 0;
  for (const row of records) {
    if (row.attendanceDate < termStart || row.attendanceDate > termEnd) continue;
    if (row.status === "absent") absences += 1;
    if (row.status === "tardy") tardies += 1;
  }
  return { absences, tardies };
}

export function countTermBehaviorConcerns(
  records: BehaviorRecordForFlags[],
  termStart: string,
  termEnd: string,
): number {
  let count = 0;
  for (const row of records) {
    if (row.behaviorDate < termStart || row.behaviorDate > termEnd) continue;
    if (!BEHAVIOR_CONCERN_TYPES.includes(row.behaviorType as BehaviorType)) continue;
    if (row.severity === "medium" || row.severity === "high") count += 1;
  }
  return count;
}

export function hasRecentPositiveRecognition(
  records: BehaviorRecordForFlags[],
  refDate: Date = new Date(),
): boolean {
  const cutoff = new Date(refDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - POSITIVE_RECOGNITION_LOOKBACK_DAYS);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  return records.some(
    (row) =>
      row.behaviorType === "positive_recognition" && row.behaviorDate >= cutoffIso,
  );
}

export function mergeSupportFlags(
  academicFlags: SupportFlag[],
  attendanceBehaviorFlags: SupportFlag[],
): SupportFlag[] {
  const seen = new Set<string>();
  const out: SupportFlag[] = [];
  for (const flag of [...academicFlags, ...attendanceBehaviorFlags]) {
    if (seen.has(flag.kind)) continue;
    seen.add(flag.kind);
    out.push(flag);
  }
  return out;
}

export function hasAttendanceConcern(flags: SupportFlag[]): boolean {
  return flags.some((f) => f.kind === "attendance_concern");
}

export function hasBehaviorConcern(flags: SupportFlag[]): boolean {
  return flags.some((f) => f.kind === "behavior_concern");
}

export function hasPositiveRecognition(flags: SupportFlag[]): boolean {
  return flags.some((f) => f.kind === "positive_recognition");
}
