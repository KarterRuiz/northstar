import { REPORT_CARD_TERMS, type ReportCardTerm } from "@/lib/report-cards/constants";

import type { ScoreStatus } from "./calculations";

export type CategoryInput = {
  name: string;
  weightPercent: string;
};

export type AssignmentInput = {
  categoryId: string;
  title: string;
  description: string;
  pointsPossible: string;
  dueDate: string;
  term: ReportCardTerm | "";
};

export type ScoreRowInput = {
  studentId: string;
  pointsEarned: string;
  status: ScoreStatus;
  feedback: string;
};

export const SCORE_STATUS_OPTIONS: { value: ScoreStatus; label: string }[] = [
  { value: "scored", label: "Scored" },
  { value: "missing", label: "Missing" },
  { value: "exempt", label: "Exempt" },
  { value: "absent", label: "Absent" },
];

export const SCORE_STATUSES: ScoreStatus[] = SCORE_STATUS_OPTIONS.map((o) => o.value);

export function scoreStatusLabel(status: ScoreStatus): string {
  return SCORE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function validateCategoryInput(input: CategoryInput): string | null {
  const name = input.name.trim();
  if (!name) return "Category name is required.";
  const weight = Number(input.weightPercent);
  if (Number.isNaN(weight) || weight < 0 || weight > 100) {
    return "Weight must be between 0 and 100.";
  }
  return null;
}

export function validateAssignmentInput(input: AssignmentInput): string | null {
  const title = input.title.trim();
  if (!title) return "Assignment title is required.";
  if (!input.categoryId) return "Select a category.";
  const points = Number(input.pointsPossible);
  if (Number.isNaN(points) || points <= 0) {
    return "Points possible must be greater than zero.";
  }
  if (input.term && !(REPORT_CARD_TERMS as readonly string[]).includes(input.term)) {
    return "Term must be T1, T2, T3, or T4.";
  }
  return null;
}

/**
 * Maps draft input to persisted `points_earned`.
 * - scored: numeric points (null if blank — treated as 0 in grade calculations)
 * - missing: always 0 in the database
 * - exempt: null
 * - absent: optional makeup points, or null if blank (still excluded from averages until status is Scored)
 */
export function parsePointsEarned(
  raw: string,
  status: ScoreStatus,
): number | null | "invalid" {
  if (status === "missing") {
    return 0;
  }
  if (status === "exempt") {
    return null;
  }
  if (status === "absent") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isNaN(n) || n < 0) return "invalid";
    return n;
  }
  // scored
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (Number.isNaN(n) || n < 0) return "invalid";
  return n;
}
