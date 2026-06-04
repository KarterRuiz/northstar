/**
 * Frontend-only classroom intelligence for the support board.
 * Pure derivations from behavior rows — extensible hooks for richer pattern engines later.
 */

import type { BehaviorLogRow } from "./load-behavior-page-data";
import { behaviorTypeToSupportCategory } from "./schema";
import type { SupportMomentCategory } from "./schema";
import {
  addDaysIsoUtc,
  calendarWeekRangeUtcContaining,
  computeClassroomSupportSnapshot,
  type ClassroomSupportSnapshot,
} from "./support-board-classroom-snapshot";

/** Card / strip trend direction — copy is supportive, not punitive. */
export type SupportMomentTrendDirection = "improving" | "needs_support" | "stable";

export const supportMomentTrendLabels: Record<SupportMomentTrendDirection, string> = {
  improving: "Improving",
  needs_support: "Needs support",
  stable: "Stable",
};

export const supportMomentTrendGlyphs: Record<SupportMomentTrendDirection, string> = {
  improving: "↑",
  needs_support: "↓",
  stable: "→",
};

export type PositiveConcernRatio = {
  positive: number;
  concern: number;
  /** Positive ÷ (positive + concern), null when denominator is 0. */
  positiveShare: number | null;
  /** Whole-number percent for display, e.g. 92 for “92%”. */
  positivePercent: number | null;
};

export type WeeklyTrendDirection = SupportMomentTrendDirection | "insufficient_data";

export type SupportPatternId =
  | "participation_improving"
  | "peer_conflict_decreasing"
  | "parent_contacts_decreasing"
  | "strategies_increasing";

export type SupportPatternFinding = {
  id: SupportPatternId;
  /** Short educator-facing phrase */
  label: string;
  /** Heuristic confidence until a richer engine replaces hooks */
  confidence: "low" | "medium";
};

export type ClassSupportClimateSummary = {
  climateLabel: string;
  /** 1–2 compact stats for the header strip */
  statHighlights: string[];
  positivePercentThisWeek: number | null;
  trendDirection: WeeklyTrendDirection;
  patterns: SupportPatternFinding[];
};

export type StudentSupportInsight = {
  trendDirection: SupportMomentTrendDirection;
  /** Screen-reader friendly trend description */
  trendAriaLabel: string;
  /** Compact line under header badges */
  momentumLine: string;
  /** Optional second line — positive % this week when tagged moments exist */
  ratioLine: string | null;
  positivePercentThisWeek: number | null;
  patterns: SupportPatternFinding[];
};

export type SupportBoardInsightContext = {
  anchorIsoDate: string;
  thisWeek: { start: string; end: string };
  priorWeek: { start: string; end: string };
  /** Week tiles + counts — same object passed to climate summary derivation. */
  classroomSnapshot: ClassroomSupportSnapshot;
  classSummary: ClassSupportClimateSummary;
  studentById: Map<string, StudentSupportInsight>;
};

export type DeriveSupportBoardInsightsOptions = {
  /** Minimum tagged positive+concern moments in a week before trend compares */
  minTaggedMomentsForTrend?: number;
};

const DEFAULT_MIN_TAGGED = 4;

function resolveCategory(row: BehaviorLogRow): SupportMomentCategory | null {
  return row.supportCategory ?? behaviorTypeToSupportCategory(row.behaviorType);
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

/** Positive share among positive+concern moments only (same framing as “ratio”). */
export function positiveConcernRatio(positive: number, concern: number): PositiveConcernRatio {
  const denom = positive + concern;
  const positiveShare = denom === 0 ? null : positive / denom;
  const positivePercent =
    positiveShare === null ? null : Math.round(positiveShare * 100);
  return { positive, concern, positiveShare, positivePercent };
}

/**
 * Compare this period’s positive share to the prior period’s.
 * Thresholds are gentle — avoids noisy flip-flops on small counts.
 */
export function weeklyTrendDirection(
  thisWeek: PositiveConcernRatio,
  priorWeek: PositiveConcernRatio,
  minTaggedMoments: number,
): WeeklyTrendDirection {
  const thisTagged = thisWeek.positive + thisWeek.concern;
  const priorTagged = priorWeek.positive + priorWeek.concern;
  if (thisTagged + priorTagged < minTaggedMoments) return "insufficient_data";
  if (thisWeek.positiveShare === null || priorWeek.positiveShare === null) {
    if (thisTagged === 0 && priorTagged === 0) return "insufficient_data";
    if (thisWeek.concern > thisWeek.positive && thisWeek.concern >= 2) return "needs_support";
    if (thisWeek.positive > thisWeek.concern && thisWeek.positive >= 2) return "improving";
    return "stable";
  }
  const delta = thisWeek.positiveShare - priorWeek.positiveShare;
  if (delta >= 0.12) return "improving";
  if (delta <= -0.12) return "needs_support";
  if (thisWeek.concern >= 3 && thisWeek.positiveShare < 0.35) return "needs_support";
  return "stable";
}

function priorWeekRangeFromThisWeekStart(weekStart: string): { start: string; end: string } {
  const dayBefore = addDaysIsoUtc(weekStart, -1);
  return calendarWeekRangeUtcContaining(dayBefore);
}

type WeekCounts = {
  positive: number;
  concern: number;
  parent: number;
  strategy: number;
  participationPositive: number;
  peerConflictConcern: number;
};

function emptyWeekCounts(): WeekCounts {
  return {
    positive: 0,
    concern: 0,
    parent: 0,
    strategy: 0,
    participationPositive: 0,
    peerConflictConcern: 0,
  };
}

function bumpWeekCounts(row: BehaviorLogRow, bucket: WeekCounts): void {
  if (isPositiveMoment(row)) {
    bucket.positive += 1;
    if (row.quickReason === "participation") bucket.participationPositive += 1;
  }
  if (isConcernMoment(row)) {
    bucket.concern += 1;
    if (row.quickReason === "peer_conflict") bucket.peerConflictConcern += 1;
  }
  if (isParentContactMoment(row)) bucket.parent += 1;
  if (isStrategyMoment(row)) bucket.strategy += 1;
}

/**
 * Lightweight pattern hooks — replace or extend with analytics / ML later.
 * Inputs are week-over-week deltas for the scoped rows (class or student).
 */
export function evaluateSupportPatternHooks(input: {
  thisWeek: WeekCounts;
  priorWeek: WeekCounts;
}): SupportPatternFinding[] {
  const out: SupportPatternFinding[] = [];
  const { thisWeek, priorWeek } = input;

  if (
    priorWeek.participationPositive > 0 &&
    thisWeek.participationPositive > priorWeek.participationPositive
  ) {
    out.push({
      id: "participation_improving",
      label: "Participation improving",
      confidence: "medium",
    });
  } else if (thisWeek.participationPositive >= 2 && priorWeek.participationPositive === 0) {
    out.push({
      id: "participation_improving",
      label: "Participation improving",
      confidence: "low",
    });
  }

  if (
    priorWeek.peerConflictConcern > 0 &&
    thisWeek.peerConflictConcern < priorWeek.peerConflictConcern
  ) {
    out.push({
      id: "peer_conflict_decreasing",
      label: "Peer conflict decreasing",
      confidence: "medium",
    });
  }

  if (priorWeek.parent > 0 && thisWeek.parent < priorWeek.parent) {
    out.push({
      id: "parent_contacts_decreasing",
      label: "Parent contacts decreased",
      confidence: "low",
    });
  }

  if (thisWeek.strategy > priorWeek.strategy && thisWeek.strategy >= 2) {
    out.push({
      id: "strategies_increasing",
      label: "Support strategies improving",
      confidence: "low",
    });
  }

  return out;
}

function climateLabelFromClass(
  positivePercent: number | null,
  weekMomentCount: number,
  lowData: boolean,
): string {
  if (lowData || weekMomentCount < 3) return "Emerging picture";
  if (positivePercent === null) return "Balanced attention";
  if (positivePercent >= 68) return "Positive";
  if (positivePercent >= 45) return "Balanced";
  return "Support-focused week";
}

function mapWeeklyTrendToCardTrend(w: WeeklyTrendDirection): SupportMomentTrendDirection {
  if (w === "insufficient_data") return "stable";
  return w;
}

function momentumLineForStudent(
  direction: SupportMomentTrendDirection,
  ratio: PositiveConcernRatio,
  patterns: SupportPatternFinding[],
): string {
  const patternLabel = patterns[0]?.label;
  if (patternLabel && (direction === "improving" || direction === "stable")) {
    return patternLabel;
  }
  if (direction === "improving") return "Strong positive momentum";
  if (direction === "needs_support") return "Needs support consistency";
  if (ratio.positivePercent !== null && ratio.positivePercent >= 60) {
    return "Steady, supportive consistency";
  }
  return "Stable week";
}

function studentPatterns(thisWeek: WeekCounts, priorWeek: WeekCounts): SupportPatternFinding[] {
  return evaluateSupportPatternHooks({ thisWeek, priorWeek });
}

export function computeStudentMomentum(input: {
  thisWeek: PositiveConcernRatio;
  priorWeek: PositiveConcernRatio;
  thisWeekCounts: WeekCounts;
  priorWeekCounts: WeekCounts;
  minTaggedMoments: number;
}): StudentSupportInsight {
  const wTrend = weeklyTrendDirection(
    input.thisWeek,
    input.priorWeek,
    input.minTaggedMoments,
  );
  const trendDirection = mapWeeklyTrendToCardTrend(wTrend);
  const patterns = studentPatterns(input.thisWeekCounts, input.priorWeekCounts);
  const ratioLine =
    input.thisWeek.positivePercent !== null &&
    input.thisWeek.positive + input.thisWeek.concern > 0
      ? `${input.thisWeek.positivePercent}% positive moments this week`
      : null;

  const momentumLine = momentumLineForStudent(trendDirection, input.thisWeek, patterns);

  const trendAriaLabel =
    trendDirection === "improving"
      ? "Recent trend: improving"
      : trendDirection === "needs_support"
        ? "Recent trend: needs additional support consistency"
        : "Recent trend: stable";

  return {
    trendDirection,
    trendAriaLabel,
    momentumLine,
    ratioLine,
    positivePercentThisWeek: input.thisWeek.positivePercent,
    patterns,
  };
}

export function computeClassClimate(input: {
  snapshot: ClassroomSupportSnapshot;
  thisWeekRatio: PositiveConcernRatio;
  priorWeekRatio: PositiveConcernRatio;
  thisWeekCounts: WeekCounts;
  priorWeekCounts: WeekCounts;
  minTaggedMoments: number;
}): ClassSupportClimateSummary {
  const trendDirection = weeklyTrendDirection(
    input.thisWeekRatio,
    input.priorWeekRatio,
    input.minTaggedMoments,
  );

  const positivePercentThisWeek = input.thisWeekRatio.positivePercent;
  const climateLabel = climateLabelFromClass(
    positivePercentThisWeek,
    input.snapshot.weekMomentCount,
    input.snapshot.lowData,
  );

  const patterns = evaluateSupportPatternHooks({
    thisWeek: input.thisWeekCounts,
    priorWeek: input.priorWeekCounts,
  });

  const statHighlights: string[] = [];
  if (positivePercentThisWeek !== null && input.thisWeekRatio.positive + input.thisWeekRatio.concern > 0) {
    statHighlights.push(`${positivePercentThisWeek}% positive moments this week`);
  } else if (input.snapshot.weekMomentCount > 0) {
    statHighlights.push(`${input.snapshot.weekMomentCount} moments logged this week`);
  }
  if (input.snapshot.strategiesThisWeek > 0) {
    statHighlights.push(`${input.snapshot.strategiesThisWeek} strategies this week`);
  } else if (input.snapshot.parentContactsThisWeek > 0) {
    statHighlights.push(`${input.snapshot.parentContactsThisWeek} parent contacts this week`);
  }

  return {
    climateLabel,
    statHighlights: statHighlights.slice(0, 2),
    positivePercentThisWeek,
    trendDirection,
    patterns,
  };
}

/**
 * Single-pass build for class header + all student cards.
 */
export function buildSupportBoardInsightContext(
  rows: BehaviorLogRow[],
  classId: string,
  studentIds: string[],
  now: Date,
  options?: DeriveSupportBoardInsightsOptions,
  precomputedClassroomSnapshot?: ClassroomSupportSnapshot,
): SupportBoardInsightContext {
  const minTagged = options?.minTaggedMomentsForTrend ?? DEFAULT_MIN_TAGGED;
  const anchorIsoDate = now.toISOString().slice(0, 10);
  const { start: twStart, end: twEnd } = calendarWeekRangeUtcContaining(anchorIsoDate);
  const priorWeek = priorWeekRangeFromThisWeekStart(twStart);

  const snapshot =
    precomputedClassroomSnapshot ?? computeClassroomSupportSnapshot(rows, now, classId);

  const classThis = emptyWeekCounts();
  const classPrior = emptyWeekCounts();
  const byStudent = new Map<string, { thisW: WeekCounts; priorW: WeekCounts }>();

  for (const sid of studentIds) {
    byStudent.set(sid, { thisW: emptyWeekCounts(), priorW: emptyWeekCounts() });
  }

  for (const r of rows) {
    if (r.classId !== classId) continue;
    if (inWeek(r.behaviorDate, twStart, twEnd)) {
      bumpWeekCounts(r, classThis);
      const cell = byStudent.get(r.studentId);
      if (cell) bumpWeekCounts(r, cell.thisW);
    } else if (inWeek(r.behaviorDate, priorWeek.start, priorWeek.end)) {
      bumpWeekCounts(r, classPrior);
      const cell = byStudent.get(r.studentId);
      if (cell) bumpWeekCounts(r, cell.priorW);
    }
  }

  const thisWeekRatio = positiveConcernRatio(classThis.positive, classThis.concern);
  const priorWeekRatio = positiveConcernRatio(classPrior.positive, classPrior.concern);

  const classSummary = computeClassClimate({
    snapshot,
    thisWeekRatio,
    priorWeekRatio,
    thisWeekCounts: classThis,
    priorWeekCounts: classPrior,
    minTaggedMoments: minTagged,
  });

  const studentById = new Map<string, StudentSupportInsight>();
  for (const sid of studentIds) {
    const cell = byStudent.get(sid) ?? { thisW: emptyWeekCounts(), priorW: emptyWeekCounts() };
    const tw = positiveConcernRatio(cell.thisW.positive, cell.thisW.concern);
    const pw = positiveConcernRatio(cell.priorW.positive, cell.priorW.concern);
    studentById.set(
      sid,
      computeStudentMomentum({
        thisWeek: tw,
        priorWeek: pw,
        thisWeekCounts: cell.thisW,
        priorWeekCounts: cell.priorW,
        minTaggedMoments: minTagged,
      }),
    );
  }

  return {
    anchorIsoDate,
    thisWeek: { start: twStart, end: twEnd },
    priorWeek,
    classroomSnapshot: snapshot,
    classSummary,
    studentById,
  };
}

export type SupportBoardInsightBundle = SupportBoardInsightContext;

/**
 * Facade for future AI / personalization: one entry point over rows + roster.
 */
export function deriveSupportBoardInsights(
  rows: BehaviorLogRow[],
  classId: string,
  studentIds: string[],
  now: Date,
  options?: DeriveSupportBoardInsightsOptions,
): SupportBoardInsightBundle {
  const classroomSnapshot = computeClassroomSupportSnapshot(rows, now, classId);
  return buildSupportBoardInsightContext(rows, classId, studentIds, now, options, classroomSnapshot);
}
