/**
 * Deterministic “growth story” aggregation for Student Support (no external AI).
 * Consumes behavior/support moments for one student; reusable for reports and transitions.
 *
 * Heuristics (keep simple, adjust in constants only when product asks):
 * - **Recent improvement (30d):** more positive-type moments than concern-type in the rolling window.
 * - **Positive after concern streak:** newest moment is positive-type and the next-older entries
 *   on the same timeline are all concern-type for at least `concernStreakMin` rows (any other
 *   type breaks the streak) — a lightweight “shift” signal, not clinical judgment.
 */

import {
  BEHAVIOR_CONCERN_TYPES,
  behaviorTypeToSupportCategory,
  type BehaviorType,
  type BehaviorSeverity,
} from "@/features/behavior/schema";
import type { SupportMomentCategory } from "@/lib/student-support/quick-reasons";
import { quickReasonLabel } from "@/lib/student-support/quick-reasons";

/** Tunable thresholds — change here, not scattered in UI. */
export const GROWTH_STORY_CONSTANTS = {
  /** Minimum total moments to show the narrative paragraph (otherwise placeholder copy). */
  minMomentsForNarrative: 3,
  /** “Recurring” = this many or more occurrences of the same tagged reason/key. */
  recurringMinOccurrences: 2,
  /** Rolling window for “recent” balance and parent recency (days). */
  recentWindowDays: 30,
  /** Window for repeated concern signals (days). */
  repeatedConcernWindowDays: 60,
  /** Concern streak length (older moments before the newest) to flag “positive after streak”. */
  concernStreakMin: 2,
} as const;

/** Minimal row shape — maps cleanly from `StudentBehaviorRecord` / `behavior_records`. */
export type GrowthStoryMomentInput = {
  id: string;
  behaviorDate: string;
  behaviorType: BehaviorType;
  supportCategory: SupportMomentCategory | null;
  severity: BehaviorSeverity;
  quickReason: string | null;
  /** Optional `behavior_records.support_tags` (guided or legacy). */
  supportTags?: readonly string[] | null;
};

export type GrowthStoryLabeledCount = {
  key: string;
  label: string;
  count: number;
};

export type GrowthStoryStrategyItem = {
  key: string;
  label: string;
  /** ISO date (YYYY-MM-DD) of first use in supplied data (chronological). */
  firstBehaviorDate: string;
};

export type GrowthStoryResult = {
  /** True when thresholds support a short narrative (see `GROWTH_STORY_CONSTANTS`). */
  hasSufficientData: boolean;
  /** Total moments supplied after internal sort (for UI/debug). */
  momentCount: number;
  recurringStrengths: GrowthStoryLabeledCount[];
  recurringSupportAreas: GrowthStoryLabeledCount[];
  /** Unique strategy quick reasons, ordered by first use (oldest → newest). */
  strategiesUsed: GrowthStoryStrategyItem[];
  recentImprovementSignals: {
    morePositivesThanConcernsLast30Days: boolean;
    /** Newest moment positive after a short run of concerns (see module doc). */
    positiveAfterConcernStreak: boolean;
  };
  repeatedConcernSignals: GrowthStoryLabeledCount[];
  parentContactHistory: {
    count: number;
    lastContactDate: string | null;
    /** Any parent-type moment in the recent window. */
    recentParentCommunication: boolean;
  };
};

function parseDateOnlyUtc(behaviorDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(behaviorDate.trim());
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Days since calendar `behaviorDate` (UTC date parts) relative to now; future dates yield negative. */
function ageInDaysUtc(behaviorDate: string, nowMs: number): number {
  const dayMs = parseDateOnlyUtc(behaviorDate);
  if (!Number.isFinite(dayMs)) return Number.POSITIVE_INFINITY;
  return Math.floor((nowMs - dayMs) / 86400000);
}

function effectiveSupportCategory(row: GrowthStoryMomentInput): SupportMomentCategory | null {
  if (row.supportCategory) return row.supportCategory;
  return behaviorTypeToSupportCategory(row.behaviorType);
}

export function isPositiveTypeMoment(row: GrowthStoryMomentInput): boolean {
  if (row.behaviorType === "positive_recognition") return true;
  return effectiveSupportCategory(row) === "positive_recognition";
}

export function isConcernTypeMoment(row: GrowthStoryMomentInput): boolean {
  if (BEHAVIOR_CONCERN_TYPES.includes(row.behaviorType)) return true;
  const cat = effectiveSupportCategory(row);
  return cat === "quick_concern";
}

export function isStrategyMoment(row: GrowthStoryMomentInput): boolean {
  if (row.behaviorType === "participation") return true;
  const cat = effectiveSupportCategory(row);
  return cat === "support_strategy";
}

export function isParentContactMoment(row: GrowthStoryMomentInput): boolean {
  if (row.behaviorType === "parent_contact") return true;
  const cat = effectiveSupportCategory(row);
  return cat === "parent_communication";
}

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase();
}

function strengthLabel(key: string): string {
  return quickReasonLabel("positive_recognition", key);
}

function concernLabel(key: string): string {
  return quickReasonLabel("quick_concern", key);
}

function strategyLabel(key: string): string {
  return quickReasonLabel("support_strategy", key);
}

function collectLabeledCounts(
  keys: Iterable<string>,
  labelForKey: (normalizedKey: string) => string,
): Map<string, { label: string; count: number }> {
  const map = new Map<string, { label: string; count: number }>();
  for (const raw of keys) {
    const key = normalizeKey(raw);
    if (!key) continue;
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      map.set(key, { label: labelForKey(key), count: 1 });
    }
  }
  return map;
}

function toRecurringList(
  map: Map<string, { label: string; count: number }>,
  min: number,
): GrowthStoryLabeledCount[] {
  return [...map.entries()]
    .filter(([, v]) => v.count >= min)
    .map(([key, v]) => ({ key, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function sortMomentsChronologicalAsc(rows: GrowthStoryMomentInput[]): GrowthStoryMomentInput[] {
  return [...rows].sort((a, b) => {
    const da = parseDateOnlyUtc(a.behaviorDate);
    const db = parseDateOnlyUtc(b.behaviorDate);
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
}

function sortMomentsNewestFirst(rows: GrowthStoryMomentInput[]): GrowthStoryMomentInput[] {
  return [...rows].sort((a, b) => {
    const da = parseDateOnlyUtc(a.behaviorDate);
    const db = parseDateOnlyUtc(b.behaviorDate);
    if (da !== db) return db - da;
    return b.id.localeCompare(a.id);
  });
}

function computeSufficientData(rows: GrowthStoryMomentInput[]): boolean {
  const n = rows.length;
  if (n >= GROWTH_STORY_CONSTANTS.minMomentsForNarrative) return true;
  if (n < 2) return false;
  let positives = 0;
  let concerns = 0;
  for (const r of rows) {
    if (isPositiveTypeMoment(r)) positives += 1;
    if (isConcernTypeMoment(r)) concerns += 1;
  }
  return positives >= 1 && concerns >= 1;
}

/**
 * Newest moment is strength-based, and the moments immediately before it (older, same timeline)
 * are all concern-type for at least `concernStreakMin` entries — interrupted by any non-concern.
 */
function positiveAfterConcernStreak(sortedNewestFirst: GrowthStoryMomentInput[]): boolean {
  if (sortedNewestFirst.length < 1 + GROWTH_STORY_CONSTANTS.concernStreakMin) return false;
  if (!isPositiveTypeMoment(sortedNewestFirst[0])) return false;
  let streak = 0;
  for (let i = 1; i < sortedNewestFirst.length; i += 1) {
    if (isConcernTypeMoment(sortedNewestFirst[i])) streak += 1;
    else break;
  }
  return streak >= GROWTH_STORY_CONSTANTS.concernStreakMin;
}

export function buildGrowthStory(rows: readonly GrowthStoryMomentInput[]): GrowthStoryResult {
  const sortedAsc = sortMomentsChronologicalAsc([...rows]);
  const sortedDesc = sortMomentsNewestFirst(sortedAsc);
  const nowMs = Date.now();

  const strengthRawKeys: string[] = [];
  const concernRawKeys: string[] = [];
  const strategyFirst = new Map<string, { label: string; first: string }>();
  const concernKeysInWindow: string[] = [];
  let parentCount = 0;
  let lastParentDateMs: number | null = null;
  let recentParent = false;

  let positives30 = 0;
  let concerns30 = 0;

  for (const r of sortedAsc) {
    const dayMs = parseDateOnlyUtc(r.behaviorDate);
    if (!Number.isFinite(dayMs)) continue;
    const ageDays = ageInDaysUtc(r.behaviorDate, nowMs);

    if (isPositiveTypeMoment(r)) {
      if (r.quickReason?.trim()) strengthRawKeys.push(r.quickReason.trim());
      for (const t of r.supportTags ?? []) {
        if (t?.trim()) strengthRawKeys.push(t.trim());
      }
    }

    if (isConcernTypeMoment(r) && r.quickReason?.trim()) {
      concernRawKeys.push(r.quickReason.trim());
      if (
        ageDays >= 0 &&
        ageDays <= GROWTH_STORY_CONSTANTS.repeatedConcernWindowDays
      ) {
        concernKeysInWindow.push(r.quickReason.trim());
      }
    }

    if (isStrategyMoment(r) && r.quickReason?.trim()) {
      const k = normalizeKey(r.quickReason);
      if (!strategyFirst.has(k)) {
        strategyFirst.set(k, {
          label: strategyLabel(r.quickReason.trim()),
          first: r.behaviorDate,
        });
      }
    }

    if (isParentContactMoment(r)) {
      parentCount += 1;
      if (lastParentDateMs === null || dayMs > lastParentDateMs) {
        lastParentDateMs = dayMs;
      }
      if (
        ageDays >= 0 &&
        ageDays <= GROWTH_STORY_CONSTANTS.recentWindowDays
      ) {
        recentParent = true;
      }
    }

    if (
      ageDays >= 0 &&
      ageDays <= GROWTH_STORY_CONSTANTS.recentWindowDays
    ) {
      if (isPositiveTypeMoment(r)) positives30 += 1;
      if (isConcernTypeMoment(r)) concerns30 += 1;
    }
  }

  const recurringStrengths = toRecurringList(
    collectLabeledCounts(strengthRawKeys, strengthLabel),
    GROWTH_STORY_CONSTANTS.recurringMinOccurrences,
  );
  const recurringSupportAreas = toRecurringList(
    collectLabeledCounts(concernRawKeys, concernLabel),
    GROWTH_STORY_CONSTANTS.recurringMinOccurrences,
  );

  const repeatedConcernSignals = toRecurringList(
    collectLabeledCounts(concernKeysInWindow, concernLabel),
    GROWTH_STORY_CONSTANTS.recurringMinOccurrences,
  );

  const strategiesUsed: GrowthStoryStrategyItem[] = [...strategyFirst.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      firstBehaviorDate: v.first,
    }))
    .sort((a, b) => parseDateOnlyUtc(a.firstBehaviorDate) - parseDateOnlyUtc(b.firstBehaviorDate));

  const lastContactDate =
    lastParentDateMs !== null && Number.isFinite(lastParentDateMs)
      ? new Date(lastParentDateMs).toISOString().slice(0, 10)
      : null;

  const momentCount = sortedAsc.length;
  const base: GrowthStoryResult = {
    hasSufficientData: false,
    momentCount,
    recurringStrengths,
    recurringSupportAreas,
    strategiesUsed,
    recentImprovementSignals: {
      morePositivesThanConcernsLast30Days: positives30 > concerns30 && positives30 + concerns30 > 0,
      positiveAfterConcernStreak: positiveAfterConcernStreak(sortedDesc),
    },
    repeatedConcernSignals,
    parentContactHistory: {
      count: parentCount,
      lastContactDate,
      recentParentCommunication: recentParent,
    },
  };

  return {
    ...base,
    hasSufficientData: computeSufficientData(sortedAsc),
  };
}

function joinPhrases(items: string[], max = 3): string {
  const slice = items.filter(Boolean).slice(0, max);
  if (slice.length === 0) return "";
  if (slice.length === 1) return slice[0];
  if (slice.length === 2) return `${slice[0]} and ${slice[1]}`;
  return `${slice.slice(0, -1).join(", ")}, and ${slice[slice.length - 1]}`;
}

/**
 * Two–three sentence neutral summary for teachers and caregivers.
 * When `result.hasSufficientData` is false, returns the standard placeholder (no PII).
 */
export function buildGrowthStoryPreviewText(result: GrowthStoryResult): string {
  if (!result.hasSufficientData) {
    return "Growth story will appear as support moments are logged over time.";
  }

  const sentences: string[] = [];

  const strengthBits = result.recurringStrengths.map((s) => s.label.toLowerCase());
  const concernBits = result.recurringSupportAreas.map((c) => c.label.toLowerCase());
  const strategyBits = result.strategiesUsed.map((s) => s.label.toLowerCase());

  if (strengthBits.length > 0 || concernBits.length > 0) {
    let s = "Recent support history shows ";
    if (strengthBits.length > 0) {
      s += joinPhrases(strengthBits);
      if (concernBits.length > 0) {
        s += `, with occasional support needed for ${joinPhrases(concernBits)}`;
      }
    } else {
      s += `occasional support needed for ${joinPhrases(concernBits)}`;
    }
    s += ".";
    sentences.push(s);
  } else {
    sentences.push(
      "Recent support history reflects a range of logged classroom support moments across the school year.",
    );
  }

  if (strategyBits.length > 0) {
    const listed = joinPhrases(strategyBits);
    const head = listed.charAt(0).toUpperCase() + listed.slice(1);
    sentences.push(
      `${head} ${strategyBits.length > 1 ? "have" : "has"} been used as supportive strategies.`,
    );
  } else {
    const improvement = result.recentImprovementSignals;
    if (improvement.morePositivesThanConcernsLast30Days || improvement.positiveAfterConcernStreak) {
      const parts: string[] = [];
      if (improvement.morePositivesThanConcernsLast30Days) {
        parts.push("more strength-based notes than quick concerns in the last month");
      }
      if (improvement.positiveAfterConcernStreak) {
        parts.push("the most recent entry is strength-based after a short series of concern notes");
      }
      sentences.push(`Compared with earlier entries, ${joinPhrases(parts, 2)}.`);
    }
  }

  const tailParts: string[] = [];
  if (result.parentContactHistory.count > 0) {
    const last = result.parentContactHistory.lastContactDate;
    tailParts.push(
      `Parent or caregiver communication appears ${result.parentContactHistory.count} time${
        result.parentContactHistory.count === 1 ? "" : "s"
      } in this history${last ? ` (most recently ${last})` : ""}`,
    );
  }
  if (result.repeatedConcernSignals.length > 0) {
    const bits = result.repeatedConcernSignals.map(
      (r) => `${r.label.toLowerCase()} (${r.count}× in the last ${GROWTH_STORY_CONSTANTS.repeatedConcernWindowDays} days)`,
    );
    tailParts.push(`repeated concern tags include ${joinPhrases(bits, 2)}`);
  }
  if (tailParts.length > 0) {
    sentences.push(`${tailParts.join(", ")}.`);
  }

  return sentences.slice(0, 3).join(" ").replace(/\s+/g, " ").trim();
}
