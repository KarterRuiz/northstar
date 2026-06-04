import { quickReasonLabel, type SupportMomentCategory } from "@/lib/student-support/quick-reasons";

import type { BehaviorLogRow } from "./load-behavior-page-data";
import { behaviorTypeToSupportCategory } from "./schema";

const MAX_VISIBLE = 2;

export type TagBucket = {
  visible: string[];
  moreCount: number;
};

export type SupportBoardMomentTags = {
  strengths: TagBucket;
  supportAreas: TagBucket;
  strategies: TagBucket;
};

function sortRowsForStudent(
  rows: BehaviorLogRow[],
  studentId: string,
  classId: string,
): BehaviorLogRow[] {
  return rows
    .filter((r) => r.studentId === studentId && r.classId === classId)
    .slice()
    .sort((a, b) => {
      const da = `${a.behaviorDate}T${a.createdAt ?? ""}`;
      const db = `${b.behaviorDate}T${b.createdAt ?? ""}`;
      return db.localeCompare(da);
    });
}

function resolveCategory(row: BehaviorLogRow): SupportMomentCategory | null {
  return row.supportCategory ?? behaviorTypeToSupportCategory(row.behaviorType);
}

function labelFromRow(row: BehaviorLogRow, category: SupportMomentCategory): string | null {
  const q = row.quickReason?.trim();
  if (!q) return null;
  return quickReasonLabel(category, q);
}

type SignalBucket = "strength" | "support" | "strategy";

function bucketForCategory(category: SupportMomentCategory): SignalBucket | null {
  switch (category) {
    case "positive_recognition":
    case "sel_observation":
      return "strength";
    case "quick_concern":
    case "intervention_followup":
      return "support";
    case "support_strategy":
      return "strategy";
    case "parent_communication":
      return null;
    default:
      return null;
  }
}

function toVisibleBucket(labels: string[]): TagBucket {
  const visible = labels.slice(0, MAX_VISIBLE);
  const moreCount = Math.max(0, labels.length - MAX_VISIBLE);
  return { visible, moreCount };
}

function truncatePreview(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Preview text for a support moment row (summary, title, or quick reason). */
export function momentPreviewFromRow(row: {
  generatedSummary: string | null;
  title: string;
  quickReason: string | null;
}): string {
  const g = row.generatedSummary?.trim();
  if (g) return truncatePreview(g, 72);
  const t = row.title?.trim();
  if (t) return truncatePreview(t, 72);
  const q = row.quickReason?.trim();
  if (q) return truncatePreview(q.replace(/_/g, " "), 72);
  return "";
}

/** Latest moment in this class from in-memory rows (e.g. after a quick save). */
export function lastSupportMomentFromRows(
  rows: BehaviorLogRow[],
  studentId: string,
  classId: string,
): { preview: string; atIso: string } | null {
  const sorted = sortRowsForStudent(rows, studentId, classId);
  const top = sorted[0];
  if (!top) return null;
  const preview = momentPreviewFromRow(top);
  if (!preview) return null;
  const atIso = top.createdAt || `${top.behaviorDate}T12:00:00.000Z`;
  return { preview, atIso };
}

export function pickNewerMoment(
  a: { preview: string; atIso: string } | null,
  b: { preview: string; atIso: string } | null,
): { preview: string; atIso: string } | null {
  if (!a) return b;
  if (!b) return a;
  const ta = Date.parse(a.atIso);
  const tb = Date.parse(b.atIso);
  if (Number.isFinite(tb) && (!Number.isFinite(ta) || tb > ta)) return b;
  return a;
}

/**
 * Derives strengths, support areas, and strategies from recent `behavior_records` for this class.
 * No placeholder copy — empty buckets stay empty.
 */
export function deriveSupportBoardMomentTags(
  rows: BehaviorLogRow[],
  studentId: string,
  classId: string,
): SupportBoardMomentTags {
  const sorted = sortRowsForStudent(rows, studentId, classId);
  const strengths: string[] = [];
  const supportAreas: string[] = [];
  const strategies: string[] = [];

  for (const row of sorted) {
    const category = resolveCategory(row);
    if (!category) continue;
    const bucket = bucketForCategory(category);
    if (!bucket) continue;
    const label = labelFromRow(row, category);
    if (!label) continue;

    const target = bucket === "strength" ? strengths : bucket === "support" ? supportAreas : strategies;
    if (target.includes(label)) continue;
    target.push(label);
  }

  return {
    strengths: toVisibleBucket(strengths),
    supportAreas: toVisibleBucket(supportAreas),
    strategies: toVisibleBucket(strategies),
  };
}

/** @deprecated Prefer `deriveSupportBoardMomentTags`; kept for call sites that expect string arrays. */
export type SupportBoardSignals = {
  strengths: string[];
  concerns: string[];
  strategies: string[];
};

/**
 * Derives compact signal lists for the support board card UI.
 * @deprecated Prefer `deriveSupportBoardMomentTags` when bucket metadata is needed.
 */
export function deriveSupportBoardSignals(
  rows: BehaviorLogRow[],
  studentId: string,
  classId: string,
): SupportBoardSignals {
  const tags = deriveSupportBoardMomentTags(rows, studentId, classId);
  return {
    strengths: tags.strengths.visible,
    concerns: tags.supportAreas.visible,
    strategies: tags.strategies.visible,
  };
}
