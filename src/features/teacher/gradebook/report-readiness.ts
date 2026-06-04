import { REPORT_CARD_TERMS } from "@/lib/report-cards/constants";

import {
  categoryAveragePercent,
  overallGradeMeta,
  type AssignmentForCalc,
  type CategoryForCalc,
  type ScoreForCalc,
} from "./calculations";
import type { GradebookAssignmentRow, GradebookCategoryRow } from "./load-gradebook-data";

export type TransitionNoteStatus = "submitted" | "draft" | "missing";

export type ReportReadinessStatus =
  | "ready"
  | "needs_grades"
  | "missing_transition_note"
  | "missing_report_card";

/**
 * Report readiness rules (preview only — no PDF generation).
 *
 * Scope: When `termFilter` is set, only assignments with that term count toward
 * grades; report cards require a final PDF for that term. With no term filter,
 * all assignments and all REPORT_CARD_TERMS apply.
 *
 * Needs grades — any of:
 * - No running overall % (no countable scores in scope)
 * - At least one in-scope assignment has no score row or status "missing"
 * - At least one in-scope category has no countable scores for the student
 *
 * Missing transition note — transition_notes for the class school year is not submitted.
 *
 * Missing report card PDF — no report_card_files row with status "final" for the
 * class school year label and required term(s) (see scope above).
 *
 * Ready — none of the above.
 *
 * Primary badge priority (first match wins): needs_grades → missing_transition_note
 * → missing_report_card → ready.
 */
export type StudentReportReadiness = {
  status: ReportReadinessStatus;
  overallPercent: number | null;
  overallLetter: string | null;
  isPartialGrade: boolean;
  missingAssignmentCount: number;
  categoriesWithoutScores: string[];
  transitionNoteStatus: TransitionNoteStatus;
  missingReportCardTerms: string[];
  reportCardFinalTerms: string[];
};

export type ReportReadinessStudentContext = {
  transitionNoteStatus: TransitionNoteStatus;
  reportCardFinalTerms: string[];
};

function assignmentsInScope(
  assignments: GradebookAssignmentRow[],
  termFilter: string,
): GradebookAssignmentRow[] {
  if (!termFilter) return assignments;
  return assignments.filter((a) => a.term === termFilter);
}

export function missingReportCardTermsForStudent(
  studentId: string,
  reportCardFinalTerms: string[],
  termFilter: string,
): string[] {
  const finalSet = new Set(reportCardFinalTerms);
  const required = termFilter ? [termFilter] : [...REPORT_CARD_TERMS];
  return required.filter((t) => !finalSet.has(t));
}

export function countMissingAssignments(args: {
  assignments: GradebookAssignmentRow[];
  scoresByAssignmentId: Map<string, ScoreForCalc>;
  studentId: string;
  termFilter: string;
}): number {
  const { assignments, scoresByAssignmentId, studentId, termFilter } = args;
  let count = 0;
  for (const a of assignmentsInScope(assignments, termFilter)) {
    const score = scoresByAssignmentId.get(`${a.id}:${studentId}`);
    if (!score) {
      count += 1;
      continue;
    }
    if (score.status === "missing") count += 1;
  }
  return count;
}

export function categoriesWithoutScores(args: {
  categories: GradebookCategoryRow[];
  assignments: AssignmentForCalc[];
  scoresByAssignmentId: Map<string, ScoreForCalc>;
  studentId: string;
  termFilter: string;
}): string[] {
  const { categories, assignments, scoresByAssignmentId, studentId, termFilter } =
    args;
  const names: string[] = [];
  for (const cat of categories) {
    const hasScopedAssignment = assignments.some(
      (a) =>
        a.categoryId === cat.id && (!termFilter || a.term === termFilter),
    );
    if (!hasScopedAssignment) continue;

    const avg = categoryAveragePercent({
      assignments,
      scoresByAssignmentId,
      studentId,
      categoryId: cat.id,
      termFilter: termFilter || null,
    });
    if (avg === null) names.push(cat.name);
  }
  return names;
}

export function deriveReportReadinessStatus(args: {
  needsGrades: boolean;
  transitionNoteStatus: TransitionNoteStatus;
  missingReportCardTerms: string[];
}): ReportReadinessStatus {
  if (args.needsGrades) return "needs_grades";
  if (args.transitionNoteStatus !== "submitted") return "missing_transition_note";
  if (args.missingReportCardTerms.length > 0) return "missing_report_card";
  return "ready";
}

export function computeStudentReportReadiness(args: {
  studentId: string;
  categories: GradebookCategoryRow[];
  assignments: GradebookAssignmentRow[];
  assignmentsForCalc: AssignmentForCalc[];
  categoriesForCalc: CategoryForCalc[];
  scoresByAssignmentId: Map<string, ScoreForCalc>;
  termFilter: string;
  context: ReportReadinessStudentContext;
}): StudentReportReadiness {
  const {
    studentId,
    categories,
    assignments,
    assignmentsForCalc,
    categoriesForCalc,
    scoresByAssignmentId,
    termFilter,
    context,
  } = args;

  const overall = overallGradeMeta({
    categories: categoriesForCalc,
    assignments: assignmentsForCalc,
    scoresByAssignmentId,
    studentId,
    termFilter: termFilter || null,
  });

  const missingAssignmentCount = countMissingAssignments({
    assignments,
    scoresByAssignmentId,
    studentId,
    termFilter,
  });

  const emptyCategories = categoriesWithoutScores({
    categories,
    assignments: assignmentsForCalc,
    scoresByAssignmentId,
    studentId,
    termFilter,
  });

  const scopedAssignments = assignmentsInScope(assignments, termFilter);
  const hasAssignmentsInScope = scopedAssignments.length > 0;

  const needsGrades =
    (hasAssignmentsInScope && overall.percent === null) ||
    missingAssignmentCount > 0 ||
    emptyCategories.length > 0;

  const missingReportCardTerms = missingReportCardTermsForStudent(
    studentId,
    context.reportCardFinalTerms,
    termFilter,
  );

  const status = deriveReportReadinessStatus({
    needsGrades,
    transitionNoteStatus: context.transitionNoteStatus,
    missingReportCardTerms,
  });

  return {
    status,
    overallPercent: overall.percent,
    overallLetter: overall.letter,
    isPartialGrade: overall.isPartial,
    missingAssignmentCount,
    categoriesWithoutScores: emptyCategories,
    transitionNoteStatus: context.transitionNoteStatus,
    missingReportCardTerms,
    reportCardFinalTerms: context.reportCardFinalTerms,
  };
}

export const reportReadinessStatusLabel: Record<ReportReadinessStatus, string> = {
  ready: "Ready",
  needs_grades: "Needs grades",
  missing_transition_note: "Missing transition note",
  missing_report_card: "Missing report card PDF",
};

export const transitionNoteStatusLabel: Record<TransitionNoteStatus, string> = {
  submitted: "Submitted",
  draft: "Draft",
  missing: "Missing",
};
