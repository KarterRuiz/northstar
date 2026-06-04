/**
 * Gradebook calculation rules (client + server).
 *
 * Assignment %:
 * - scored: (points_earned ?? 0) / points_possible × 100
 * - missing: 0% (counts toward category average); points are stored as 0
 * - exempt: excluded from category average (no numerator or denominator weight)
 * - absent: excluded from category average; optional makeup points may be stored for
 *   teacher reference but do not affect % until status is changed to Scored
 *
 * Category average:
 * - Weighted mean of assignment % within the category, weights = points_possible
 * - Only assignments with a countable % (scored or missing) participate
 *
 * Running overall (displayed term grade):
 * - Only categories with at least one countable assignment (scored or missing)
 * - running = sum(category_avg × weight) / sum(weights for those categories)
 * - When every category has scores, matches full weighted overall (weights → 100%)
 */

export type ScoreStatus = "scored" | "missing" | "exempt" | "absent";

export type AssignmentForCalc = {
  id: string;
  categoryId: string;
  pointsPossible: number;
  term: string | null;
};

export type ScoreForCalc = {
  assignmentId: string;
  studentId: string;
  pointsEarned: number | null;
  status: ScoreStatus;
};

export type CategoryForCalc = {
  id: string;
  weightPercent: number;
};

/** Composite key for per-student score maps (see buildScoreMap). */
export function scoreMapKey(assignmentId: string, studentId: string): string {
  return `${assignmentId}:${studentId}`;
}

export function assignmentPercent(args: {
  pointsPossible: number;
  pointsEarned: number | null;
  status: ScoreStatus;
}): number | null {
  const { pointsPossible, pointsEarned, status } = args;
  if (pointsPossible <= 0) return null;
  if (status === "exempt" || status === "absent") return null;
  if (status === "missing") return 0;
  const earned = pointsEarned ?? 0;
  return (earned / pointsPossible) * 100;
}

export function categoryAveragePercent(args: {
  assignments: AssignmentForCalc[];
  scoresByAssignmentId: Map<string, ScoreForCalc>;
  studentId: string;
  categoryId: string;
  termFilter?: string | null;
}): number | null {
  const { assignments, scoresByAssignmentId, studentId, categoryId, termFilter } =
    args;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const a of assignments) {
    if (a.categoryId !== categoryId) continue;
    if (termFilter && a.term !== termFilter) continue;

    const score = scoresByAssignmentId.get(scoreMapKey(a.id, studentId));
    if (!score) continue;

    const pct = assignmentPercent({
      pointsPossible: a.pointsPossible,
      pointsEarned: score.pointsEarned,
      status: score.status,
    });
    if (pct === null) continue;

    weightedSum += pct * a.pointsPossible;
    weightTotal += a.pointsPossible;
  }

  if (weightTotal <= 0) return null;
  return weightedSum / weightTotal;
}

/** Weight-normalized overall using only categories that have entered scores. */
export function runningOverallPercent(args: {
  categories: CategoryForCalc[];
  assignments: AssignmentForCalc[];
  scoresByAssignmentId: Map<string, ScoreForCalc>;
  studentId: string;
  termFilter?: string | null;
}): number | null {
  const { categories, assignments, scoresByAssignmentId, studentId, termFilter } =
    args;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const cat of categories) {
    const catAvg = categoryAveragePercent({
      assignments,
      scoresByAssignmentId,
      studentId,
      categoryId: cat.id,
      termFilter,
    });
    if (catAvg !== null) {
      weightedSum += catAvg * cat.weightPercent;
      weightTotal += cat.weightPercent;
    }
  }

  if (weightTotal <= 0) return null;
  return weightedSum / weightTotal;
}

/** @deprecated Use runningOverallPercent — same formula. */
export function overallWeightedPercent(
  args: Parameters<typeof runningOverallPercent>[0],
): number | null {
  return runningOverallPercent(args);
}

export function sumCategoryWeights(categories: { weightPercent: number }[]): number {
  return categories.reduce((sum, c) => sum + c.weightPercent, 0);
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function letterGradeFromPercent(percent: number): string {
  if (percent >= 97) return "A+";
  if (percent >= 93) return "A";
  if (percent >= 90) return "A-";
  if (percent >= 87) return "B+";
  if (percent >= 83) return "B";
  if (percent >= 80) return "B-";
  if (percent >= 77) return "C+";
  if (percent >= 73) return "C";
  if (percent >= 70) return "C-";
  if (percent >= 60) return "D";
  return "F";
}

export type OverallGradeMeta = {
  percent: number | null;
  letter: string | null;
  /** True when at least one category has scores but not all categories do. */
  isPartial: boolean;
};

export function formatOverallGrade(meta: OverallGradeMeta, digits = 1): string {
  if (meta.percent === null) return "—";
  const letter = meta.letter ? ` ${meta.letter}` : "";
  return `${formatPercent(meta.percent, digits)}${letter}`;
}

export function overallGradeMeta(args: {
  categories: CategoryForCalc[];
  assignments: AssignmentForCalc[];
  scoresByAssignmentId: Map<string, ScoreForCalc>;
  studentId: string;
  termFilter?: string | null;
}): OverallGradeMeta {
  const { categories, assignments, scoresByAssignmentId, studentId, termFilter } =
    args;

  let categoriesWithData = 0;

  for (const cat of categories) {
    const catAvg = categoryAveragePercent({
      assignments,
      scoresByAssignmentId,
      studentId,
      categoryId: cat.id,
      termFilter,
    });
    if (catAvg !== null) categoriesWithData += 1;
  }

  const percent = runningOverallPercent({
    categories,
    assignments,
    scoresByAssignmentId,
    studentId,
    termFilter,
  });

  const isPartial =
    categories.length > 0 &&
    categoriesWithData > 0 &&
    categoriesWithData < categories.length;

  return {
    percent,
    letter: percent !== null ? letterGradeFromPercent(percent) : null,
    isPartial,
  };
}
