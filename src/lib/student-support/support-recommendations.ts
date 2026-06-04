/**
 * Lightweight deterministic hints for Student Support (MTSS-like tone).
 *
 * ## Repeated-pattern threshold (work habits: off_task / incomplete_work)
 * A rule triggers when **either**:
 * - **Last 10 moments** (all categories, newest-first by `behavior_date`) include ≥2
 *   qualifying `quick_concern` rows with the given reason key(s), **or**
 * - **Rolling 30 calendar days** on `behavior_date` (ISO `YYYY-MM-DD`) include ≥2
 *   qualifying rows (same as above).
 *
 * Peer conflict and emotional regulation use the same **last-10 OR 30d** rule for consistency.
 *
 * ## Strategy de-duplication
 * Suggested classroom strategies skip options already logged as **`support_strategy`**
 * with the matching `quick_reason` within the last **14 days** (calendar). SEL / intervention
 * hints use category-aware matching where noted in each option.
 */
import {
  quickReasonLabel,
  supportMomentCategories,
  type SupportMomentCategory,
} from "./quick-reasons";

/** Days back for rolling-window counts (alternative to last-10 slice). */
export const SUPPORT_RECOMMENDATION_REPEAT_LOOKBACK_DAYS = 30;

/** Days back to treat a strategy as “already logged recently”. */
export const SUPPORT_RECOMMENDATION_STRATEGY_RECENT_LOOKBACK_DAYS = 14;

/** Minimum positive recognition moments in the 30d window to suggest enrichment. */
export const SUPPORT_RECOMMENDATION_POSITIVE_FREQUENCY_THRESHOLD = 3;

/** Minimum occurrences to count as “repeated” inside the 30d window (paired with last-10 rule). */
export const SUPPORT_RECOMMENDATION_REPEAT_MIN_COUNT = 2;

/** Newest-first slice size for the “recent streak” alternative threshold. */
export const SUPPORT_RECOMMENDATION_RECENT_MOMENT_SLICE = 10;

export type MinimalMoment = {
  behavior_type?: string;
  support_category?: string | null;
  quick_reason: string | null;
  behavior_date: string;
  flags?: Record<string, boolean | undefined>;
};

const BEHAVIOR_TO_CATEGORY: Partial<Record<string, SupportMomentCategory>> = {
  positive_recognition: "positive_recognition",
  classroom_concern: "quick_concern",
  behavior_incident: "quick_concern",
  parent_contact: "parent_communication",
  social_emotional: "sel_observation",
  participation: "support_strategy",
  intervention_followup: "intervention_followup",
};

const SUPPORT_CATEGORY_SET = new Set<string>(supportMomentCategories);

function resolveCategory(m: MinimalMoment): SupportMomentCategory | null {
  const sc = m.support_category?.trim();
  if (sc && SUPPORT_CATEGORY_SET.has(sc)) {
    return sc as SupportMomentCategory;
  }
  const bt = m.behavior_type?.trim();
  if (bt && BEHAVIOR_TO_CATEGORY[bt]) {
    return BEHAVIOR_TO_CATEGORY[bt]!;
  }
  return null;
}

function isoDateCutoffLocal(now: Date, daysAgo: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function inLookback(behaviorDate: string, cutoffInclusive: string): boolean {
  return behaviorDate >= cutoffInclusive;
}

function normQuick(m: MinimalMoment): string | null {
  const q = m.quick_reason?.trim();
  return q || null;
}

function recentMomentSlice(moments: MinimalMoment[], n: number): MinimalMoment[] {
  return [...moments]
    .filter((m) => Boolean(m.behavior_date?.trim()))
    .sort((a, b) => b.behavior_date.localeCompare(a.behavior_date))
    .slice(0, n);
}

function countQuickConcernWithKeysInSlice(slice: MinimalMoment[], keys: readonly string[]): number {
  let n = 0;
  for (const m of slice) {
    if (resolveCategory(m) !== "quick_concern") continue;
    const q = normQuick(m);
    if (q && keys.includes(q)) n += 1;
  }
  return n;
}

function countQuickConcernInWindow(
  moments: MinimalMoment[],
  windowCutoffInclusive: string,
  keys: readonly string[],
): number {
  let n = 0;
  for (const m of moments) {
    if (!inLookback(m.behavior_date, windowCutoffInclusive)) continue;
    if (resolveCategory(m) !== "quick_concern") continue;
    const q = normQuick(m);
    if (q && keys.includes(q)) n += 1;
  }
  return n;
}

function repeatedQuickConcern(
  moments: MinimalMoment[],
  now: Date,
  keys: readonly string[],
): boolean {
  const cutoff30 = isoDateCutoffLocal(now, SUPPORT_RECOMMENDATION_REPEAT_LOOKBACK_DAYS);
  const last10 = recentMomentSlice(moments, SUPPORT_RECOMMENDATION_RECENT_MOMENT_SLICE);
  const in10 = countQuickConcernWithKeysInSlice(last10, keys);
  const in30 = countQuickConcernInWindow(moments, cutoff30, keys);
  return (
    in10 >= SUPPORT_RECOMMENDATION_REPEAT_MIN_COUNT ||
    in30 >= SUPPORT_RECOMMENDATION_REPEAT_MIN_COUNT
  );
}

function countPositiveMomentsInWindow(moments: MinimalMoment[], windowCutoffInclusive: string): number {
  let n = 0;
  for (const m of moments) {
    if (!inLookback(m.behavior_date, windowCutoffInclusive)) continue;
    if (resolveCategory(m) === "positive_recognition") n += 1;
  }
  return n;
}

type StrategyOption = { label: string; alreadyUsed: (m: MinimalMoment) => boolean };

function pickStrategyLabel(
  options: readonly StrategyOption[],
  moments: MinimalMoment[],
  strategyCutoffInclusive: string,
): string {
  outer: for (const o of options) {
    for (const m of moments) {
      if (!inLookback(m.behavior_date, strategyCutoffInclusive)) continue;
      if (o.alreadyUsed(m)) continue outer;
    }
    return o.label;
  }
  return options[0]!.label;
}

const isCat =
  (c: SupportMomentCategory) =>
  (m: MinimalMoment): boolean =>
    resolveCategory(m) === c;

const qrEq =
  (...keys: readonly string[]) =>
  (m: MinimalMoment): boolean => {
    const q = normQuick(m);
    return Boolean(q && keys.includes(q));
  };

const WORK_STRATEGIES: readonly StrategyOption[] = [
  {
    label: quickReasonLabel("support_strategy", "task_chunking"),
    alreadyUsed: (m) => isCat("support_strategy")(m) && qrEq("task_chunking")(m),
  },
  {
    label: quickReasonLabel("support_strategy", "visual_reminder"),
    alreadyUsed: (m) => isCat("support_strategy")(m) && qrEq("visual_reminder", "visual_reminders")(m),
  },
  {
    label: quickReasonLabel("support_strategy", "teacher_check_in"),
    alreadyUsed: (m) => isCat("support_strategy")(m) && qrEq("teacher_check_in")(m),
  },
];

const PEER_STRATEGIES: readonly StrategyOption[] = [
  {
    label: "Structured partner role",
    alreadyUsed: (m) => isCat("support_strategy")(m) && qrEq("peer_support")(m),
  },
  {
    label: "SEL check-in",
    alreadyUsed: (m) =>
      (isCat("support_strategy")(m) && qrEq("check_in_out")(m)) ||
      (isCat("intervention_followup")(m) && qrEq("tier1_checkin")(m)),
  },
  {
    label: quickReasonLabel("support_strategy", "teacher_conference"),
    alreadyUsed: (m) => isCat("support_strategy")(m) && qrEq("teacher_conference")(m),
  },
];

const EMOTIONAL_STRATEGIES: readonly StrategyOption[] = [
  {
    label: quickReasonLabel("support_strategy", "movement_break"),
    alreadyUsed: (m) => isCat("support_strategy")(m) && qrEq("movement_break")(m),
  },
  {
    label: "Calm reset routine",
    alreadyUsed: (m) =>
      (isCat("support_strategy")(m) && qrEq("positive_reinforcement")(m)) ||
      (isCat("sel_observation")(m) && qrEq("calm_recovery", "coping_strategy", "mindfulness_focus")(m)),
  },
  {
    label: "Predictable transition support",
    alreadyUsed: (m) =>
      (isCat("support_strategy")(m) &&
        qrEq("seating_adjustment", "visual_reminder", "visual_reminders", "check_in_out")(m)) ||
      (isCat("quick_concern")(m) && qrEq("transition_difficulty", "difficulty_transitioning")(m)),
  },
];

const POSITIVE_STRATEGIES: readonly StrategyOption[] = [
  {
    label: "Leadership opportunity",
    alreadyUsed: (m) => isCat("positive_recognition")(m) && qrEq("leadership")(m),
  },
  {
    label: "Peer mentor role",
    alreadyUsed: (m) =>
      (isCat("positive_recognition")(m) && qrEq("collaboration")(m)) ||
      (isCat("support_strategy")(m) && qrEq("peer_support")(m)),
  },
  {
    label: "Positive parent update",
    alreadyUsed: (m) => isCat("parent_communication")(m) && qrEq("positive_update")(m),
  },
];

/**
 * Deterministic “next nudge” label for the support board. When several rules qualify,
 * **first matching rule wins** (peer conflict → emotional regulation → work habits → frequent positives).
 */
export function getSuggestedNextSupport(
  studentMoments: MinimalMoment[],
  now: Date,
): { label: string } | null {
  const cutoff30 = isoDateCutoffLocal(now, SUPPORT_RECOMMENDATION_REPEAT_LOOKBACK_DAYS);
  const cutoff14 = isoDateCutoffLocal(now, SUPPORT_RECOMMENDATION_STRATEGY_RECENT_LOOKBACK_DAYS);

  if (repeatedQuickConcern(studentMoments, now, ["peer_conflict"])) {
    return {
      label: pickStrategyLabel(PEER_STRATEGIES, studentMoments, cutoff14),
    };
  }

  if (repeatedQuickConcern(studentMoments, now, ["emotional_regulation"])) {
    return {
      label: pickStrategyLabel(EMOTIONAL_STRATEGIES, studentMoments, cutoff14),
    };
  }

  if (repeatedQuickConcern(studentMoments, now, ["off_task", "incomplete_work"])) {
    return {
      label: pickStrategyLabel(WORK_STRATEGIES, studentMoments, cutoff14),
    };
  }

  const positiveCount = countPositiveMomentsInWindow(studentMoments, cutoff30);
  if (positiveCount >= SUPPORT_RECOMMENDATION_POSITIVE_FREQUENCY_THRESHOLD) {
    return {
      label: pickStrategyLabel(POSITIVE_STRATEGIES, studentMoments, cutoff14),
    };
  }

  return null;
}
