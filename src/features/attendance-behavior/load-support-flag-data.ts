import "server-only";

import { cache } from "react";

import { currentTermDateRange } from "@/lib/school-term";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { tallyAttendanceConcernMetrics } from "@/features/attendance/attendance-concerns";
import {
  computeAttendanceConcernFlag,
  computeBehaviorConcernFlag,
  computePositiveRecognitionFlag,
  countTermBehaviorConcerns,
  hasRecentPositiveRecognition,
  type SupportFlag,
} from "@/features/interventions/support-flags";

export type StudentSupportFlagInput = {
  studentId: string;
  classId: string;
  schoolYearLabel: string;
  termStart: string;
  termEnd: string;
};

type AttendanceDbRow = {
  student_id: string;
  class_id: string;
  attendance_date: string;
  status: string;
};

type BehaviorDbRow = {
  student_id: string;
  class_id: string;
  behavior_date: string;
  behavior_type: string;
  severity: string;
};

function flagKey(studentId: string, classId: string): string {
  return `${studentId}:${classId}`;
}

export async function loadSchoolYearTermContext(): Promise<
  | {
      ok: true;
      schoolYearLabel: string;
      termStart: string;
      termEnd: string;
    }
  | { ok: false; message: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("school_years")
    .select("label, starts_on, ends_on")
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) {
    return { ok: false, message: "No school year configured." };
  }

  const { start, end } = currentTermDateRange(data.starts_on, data.ends_on);
  return {
    ok: true,
    schoolYearLabel: data.label,
    termStart: start,
    termEnd: end,
  };
}

function resolveSchoolYearLabels(
  keys: StudentSupportFlagInput[],
  fallbackLabel: string,
): string[] {
  const fromKeys = [
    ...new Set(
      keys.map((k) => k.schoolYearLabel.trim()).filter((label) => label.length > 0),
    ),
  ];
  if (fromKeys.length > 0) return fromKeys;
  return fallbackLabel ? [fallbackLabel] : [];
}

async function loadAttendanceForKeys(
  keys: StudentSupportFlagInput[],
  schoolYearLabels: string[],
  termStart: string,
  termEnd: string,
): Promise<Map<string, AttendanceDbRow[]>> {
  const byKey = new Map<string, AttendanceDbRow[]>();
  if (!isSupabaseConfigured() || keys.length === 0 || schoolYearLabels.length === 0) {
    return byKey;
  }

  const studentIds = [...new Set(keys.map((k) => k.studentId))];
  const classIds = [...new Set(keys.map((k) => k.classId))];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("attendance_records")
    .select("student_id, class_id, attendance_date, status")
    .in("school_year", schoolYearLabels)
    .in("student_id", studentIds)
    .in("class_id", classIds)
    .gte("attendance_date", termStart)
    .lte("attendance_date", termEnd);

  if (error) return byKey;

  for (const row of (data ?? []) as AttendanceDbRow[]) {
    const key = flagKey(row.student_id, row.class_id);
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }
  return byKey;
}

async function loadBehaviorForKeys(
  keys: StudentSupportFlagInput[],
  schoolYearLabels: string[],
): Promise<Map<string, BehaviorDbRow[]>> {
  const byKey = new Map<string, BehaviorDbRow[]>();
  if (!isSupabaseConfigured() || keys.length === 0 || schoolYearLabels.length === 0) {
    return byKey;
  }

  const studentIds = [...new Set(keys.map((k) => k.studentId))];
  const classIds = [...new Set(keys.map((k) => k.classId))];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("behavior_records")
    .select("student_id, class_id, behavior_date, behavior_type, severity")
    .in("school_year", schoolYearLabels)
    .in("student_id", studentIds)
    .in("class_id", classIds)
    .order("behavior_date", { ascending: false });

  if (error) return byKey;

  for (const row of (data ?? []) as BehaviorDbRow[]) {
    const key = flagKey(row.student_id, row.class_id);
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }
  return byKey;
}

export function computeSupportFlagsForStudent(args: {
  attendanceRows: AttendanceDbRow[];
  behaviorRows: BehaviorDbRow[];
  termStart: string;
  termEnd: string;
}): SupportFlag[] {
  const attendanceMetrics = tallyAttendanceConcernMetrics(
    args.attendanceRows.map((r) => ({
      attendanceDate: r.attendance_date,
      status: r.status,
    })),
    args.termStart,
    args.termEnd,
  );

  const flags: SupportFlag[] = [];
  const attendanceFlag = computeAttendanceConcernFlag(attendanceMetrics);
  if (attendanceFlag) flags.push(attendanceFlag);

  const concernCount = countTermBehaviorConcerns(
    args.behaviorRows.map((r) => ({
      behaviorDate: r.behavior_date,
      behaviorType: r.behavior_type,
      severity: r.severity,
    })),
    args.termStart,
    args.termEnd,
  );
  const behaviorFlag = computeBehaviorConcernFlag(concernCount);
  if (behaviorFlag) flags.push(behaviorFlag);

  const positiveFlag = computePositiveRecognitionFlag(
    hasRecentPositiveRecognition(
      args.behaviorRows.map((r) => ({
        behaviorDate: r.behavior_date,
        behaviorType: r.behavior_type,
        severity: r.severity,
      })),
    ),
  );
  if (positiveFlag) flags.push(positiveFlag);

  return flags;
}

export const loadSupportFlagsForRoster = cache(async function loadSupportFlagsForRoster(
  keys: StudentSupportFlagInput[],
): Promise<Map<string, SupportFlag[]>> {
  const out = new Map<string, SupportFlag[]>();
  if (keys.length === 0) return out;

  const termCtx = await loadSchoolYearTermContext();
  if (!termCtx.ok) return out;

  const schoolYearLabels = resolveSchoolYearLabels(keys, termCtx.schoolYearLabel);

  const [attendanceByKey, behaviorByKey] = await Promise.all([
    loadAttendanceForKeys(
      keys,
      schoolYearLabels,
      termCtx.termStart,
      termCtx.termEnd,
    ),
    loadBehaviorForKeys(keys, schoolYearLabels),
  ]);

  for (const key of keys) {
    const mapKey = flagKey(key.studentId, key.classId);
    const attendanceRows = attendanceByKey.get(mapKey) ?? [];
    const behaviorRows = behaviorByKey.get(mapKey) ?? [];
    out.set(
      mapKey,
      computeSupportFlagsForStudent({
        attendanceRows,
        behaviorRows,
        termStart: termCtx.termStart,
        termEnd: termCtx.termEnd,
      }),
    );
  }

  return out;
});

export async function loadSupportFlagsForStudent(args: {
  studentId: string;
  classId: string;
  schoolYearLabel: string;
  termStart: string;
  termEnd: string;
}): Promise<SupportFlag[]> {
  const key = flagKey(args.studentId, args.classId);
  const map = await loadSupportFlagsForRoster([
    {
      studentId: args.studentId,
      classId: args.classId,
      schoolYearLabel: args.schoolYearLabel,
      termStart: args.termStart,
      termEnd: args.termEnd,
    },
  ]);
  return map.get(key) ?? [];
}
