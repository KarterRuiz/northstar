import { quickReasonLabel, type SupportMomentCategory } from "@/lib/student-support/quick-reasons";

import type { BehaviorLogRow } from "./load-behavior-page-data";

/** Same shape as timeline / `loadBehaviorPageData` rows (alias for snapshot API docs). */
export type BehaviorRow = BehaviorLogRow;
import { behaviorTypeToSupportCategory } from "./schema";

/** Minimum logged moments in the class week window before we show pattern insight copy. */
export const CLASSROOM_SNAPSHOT_LOW_DATA_THRESHOLD = 3;

/**
 * Calendar week for snapshot metrics: **Monday through Sunday**, using UTC date parts
 * (same Monday anchor as `weekRangeContaining` in `@/features/attendance/attendance-date-utils`,
 * extended through Sunday instead of Friday so weekend logs still fall in “this week”).
 */
export function calendarWeekRangeUtcContaining(anchorIsoDate: string): { start: string; end: string } {
  const [y, m, d] = anchorIsoDate.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function resolveCategory(row: BehaviorLogRow): SupportMomentCategory | null {
  return row.supportCategory ?? behaviorTypeToSupportCategory(row.behaviorType);
}

export function addDaysIsoUtc(isoYmd: string, deltaDays: number): string {
  const [y, m, d] = isoYmd.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/**
 * Distinct students with `followUpRequired` on any row in the **last 14 calendar days**
 * (UTC `behavior_date`, inclusive of today), scoped to `classId`.
 */
function distinctStudentsNeedingFollowUp(
  rows: BehaviorLogRow[],
  classId: string,
  anchorIso: string,
): number {
  const start = addDaysIsoUtc(anchorIso, -13);
  const students = new Set<string>();
  for (const r of rows) {
    if (r.classId !== classId) continue;
    if (!r.followUpRequired) continue;
    if (r.behaviorDate < start || r.behaviorDate > anchorIso) continue;
    students.add(r.studentId);
  }
  return students.size;
}

function inWeek(behaviorDate: string, weekStart: string, weekEnd: string): boolean {
  return behaviorDate >= weekStart && behaviorDate <= weekEnd;
}

function isPositiveMoment(row: BehaviorLogRow): boolean {
  const cat = resolveCategory(row);
  return cat === "positive_recognition" || row.behaviorType === "positive_recognition";
}

function isConcernMoment(row: BehaviorLogRow): boolean {
  const cat = resolveCategory(row);
  return cat === "quick_concern";
}

function isParentContactMoment(row: BehaviorLogRow): boolean {
  const cat = resolveCategory(row);
  return cat === "parent_communication" || row.behaviorType === "parent_contact";
}

function isStrategyMoment(row: BehaviorLogRow): boolean {
  const cat = resolveCategory(row);
  return cat === "support_strategy" || row.behaviorType === "participation";
}

/** Keys to aggregate for one row; quick_reason wins when set so one moment maps to one primary tag. */
function primaryTagKeys(row: BehaviorLogRow): string[] {
  const qr = row.quickReason?.trim();
  if (qr) return [qr];
  const tags = row.supportTags?.filter((t) => Boolean(t?.trim())) ?? [];
  return tags.map((t) => t.trim());
}

function incrementCounts(counts: Map<string, number>, keys: string[]) {
  for (const k of keys) {
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
}

/** Highest count, tie-break lexicographic ascending on key for stability. */
function pickTopKey(counts: Map<string, number>): string | null {
  if (counts.size === 0) return null;
  let bestKey: string | null = null;
  let bestN = -1;
  const keys = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  for (const k of keys) {
    const n = counts.get(k) ?? 0;
    if (n > bestN) {
      bestN = n;
      bestKey = k;
    }
  }
  return bestKey;
}

export type ClassroomSupportSnapshot = {
  classId: string;
  anchorIsoDate: string;
  weekStart: string;
  weekEnd: string;
  weekMomentCount: number;
  lowData: boolean;
  positiveMomentsThisWeek: number;
  studentsNeedingFollowUp: number;
  topStrengthKey: string | null;
  topStrengthLabel: string | null;
  topSupportAreaKey: string | null;
  topSupportAreaLabel: string | null;
  parentContactsThisWeek: number;
  strategiesThisWeek: number;
  insightLine: string | null;
};

export function buildClassroomSnapshotInsightLine(
  topStrengthLabel: string | null,
  topSupportAreaLabel: string | null,
): string | null {
  const parts: string[] = [];
  if (topStrengthLabel) {
    parts.push(`${topStrengthLabel} is the strongest positive pattern this week.`);
  }
  if (topSupportAreaLabel) {
    parts.push(`${topSupportAreaLabel} is the most common support area.`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Pure snapshot for the support board: filters `rows` to `classId`, uses `now` for “today”
 * (UTC YYYY-MM-DD) and the Monday–Sunday week containing that day.
 */
export function computeClassroomSupportSnapshot(
  rows: BehaviorRow[],
  now: Date,
  classId: string,
): ClassroomSupportSnapshot {
  const anchorIsoDate = now.toISOString().slice(0, 10);
  const { start: weekStart, end: weekEnd } = calendarWeekRangeUtcContaining(anchorIsoDate);

  const classRows = rows.filter((r) => r.classId === classId);

  let weekMomentCount = 0;
  let positiveMomentsThisWeek = 0;
  let parentContactsThisWeek = 0;
  let strategiesThisWeek = 0;

  const strengthCounts = new Map<string, number>();
  const concernCounts = new Map<string, number>();

  for (const r of classRows) {
    if (!inWeek(r.behaviorDate, weekStart, weekEnd)) continue;
    weekMomentCount += 1;

    if (isPositiveMoment(r)) {
      positiveMomentsThisWeek += 1;
      incrementCounts(strengthCounts, primaryTagKeys(r));
    }
    if (isConcernMoment(r)) {
      incrementCounts(concernCounts, primaryTagKeys(r));
    }
    if (isParentContactMoment(r)) {
      parentContactsThisWeek += 1;
    }
    if (isStrategyMoment(r)) {
      strategiesThisWeek += 1;
    }
  }

  const studentsNeedingFollowUp = distinctStudentsNeedingFollowUp(classRows, classId, anchorIsoDate);

  const topStrengthKey = pickTopKey(strengthCounts);
  const topSupportAreaKey = pickTopKey(concernCounts);

  const topStrengthLabel = topStrengthKey
    ? quickReasonLabel("positive_recognition", topStrengthKey)
    : null;
  const topSupportAreaLabel = topSupportAreaKey
    ? quickReasonLabel("quick_concern", topSupportAreaKey)
    : null;

  const lowData = weekMomentCount < CLASSROOM_SNAPSHOT_LOW_DATA_THRESHOLD;
  const insightLine =
    !lowData && (topStrengthLabel || topSupportAreaLabel)
      ? buildClassroomSnapshotInsightLine(topStrengthLabel, topSupportAreaLabel)
      : null;

  return {
    classId,
    anchorIsoDate,
    weekStart,
    weekEnd,
    weekMomentCount,
    lowData,
    positiveMomentsThisWeek,
    studentsNeedingFollowUp,
    topStrengthKey,
    topStrengthLabel,
    topSupportAreaKey,
    topSupportAreaLabel,
    parentContactsThisWeek,
    strategiesThisWeek,
    insightLine,
  };
}
