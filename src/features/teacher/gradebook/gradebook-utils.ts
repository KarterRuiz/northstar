import {
  scoreMapKey,
  type ScoreForCalc,
  type ScoreStatus,
} from "./calculations";
import { parsePointsEarned } from "./schema";
import type {
  GradebookAssignmentRow,
  GradebookScoreRow,
  GradebookStudentRow,
} from "./load-gradebook-data";
import { cn } from "@/lib/utils";

export const selectClassName = cn(
  "border-input bg-background flex h-8 w-full rounded-md border px-2 py-1 text-xs shadow-xs",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export type ScoreDraftRow = {
  pointsEarned: string;
  status: ScoreStatus;
  feedback: string;
};

export type GradebookTab =
  | "grid"
  | "assignments"
  | "categories"
  | "reports"
  | "readiness";

export function scoreKey(assignmentId: string, studentId: string): string {
  return `${assignmentId}:${studentId}`;
}

export function defaultScoreDraftRow(): ScoreDraftRow {
  return { pointsEarned: "0", status: "missing", feedback: "" };
}

/** Normalize drafts so missing + empty points compares equal to missing + "0". */
export function normalizeScoreDraftForCompare(d: ScoreDraftRow): ScoreDraftRow {
  if (d.status === "missing" && d.pointsEarned.trim() === "") {
    return { ...d, pointsEarned: "0" };
  }
  return d;
}

/** When the teacher changes status, apply default points behavior. */
export function nextDraftForStatusChange(
  draft: ScoreDraftRow,
  nextStatus: ScoreStatus,
): ScoreDraftRow {
  switch (nextStatus) {
    case "missing":
      return { ...draft, status: "missing", pointsEarned: "0" };
    case "exempt":
      return { ...draft, status: "exempt", pointsEarned: "" };
    case "absent":
      return { ...draft, status: "absent", pointsEarned: draft.pointsEarned };
    case "scored": {
      let pts = draft.pointsEarned;
      if (draft.status === "missing" && pts === "0") pts = "";
      return { ...draft, status: "scored", pointsEarned: pts };
    }
  }
}

export function buildScoreMap(scores: GradebookScoreRow[]): Map<string, ScoreForCalc> {
  const map = new Map<string, ScoreForCalc>();
  for (const s of scores) {
    map.set(scoreMapKey(s.assignmentId, s.studentId), {
      assignmentId: s.assignmentId,
      studentId: s.studentId,
      pointsEarned: s.pointsEarned,
      status: s.status,
    });
  }
  return map;
}

const EMPTY_STUDENT_SCORES: GradebookScoreRow[] = [];

/** O(scores) index — avoids per-row .filter over the full score list. */
export function groupScoresByStudentId(
  scores: GradebookScoreRow[],
): Map<string, GradebookScoreRow[]> {
  const byStudent = new Map<string, GradebookScoreRow[]>();
  for (const s of scores) {
    const list = byStudent.get(s.studentId);
    if (list) list.push(s);
    else byStudent.set(s.studentId, [s]);
  }
  return byStudent;
}

export function scoresForStudent(
  byStudent: Map<string, GradebookScoreRow[]>,
  studentId: string,
): GradebookScoreRow[] {
  return byStudent.get(studentId) ?? EMPTY_STUDENT_SCORES;
}

export function buildScoreDraft(
  assignment: GradebookAssignmentRow | undefined,
  scores: GradebookScoreRow[],
  students: GradebookStudentRow[],
): Record<string, ScoreDraftRow> {
  if (!assignment) return {};
  const next: Record<string, ScoreDraftRow> = {};
  for (const st of students) {
    const existing = scores.find(
      (s) => s.assignmentId === assignment.id && s.studentId === st.studentId,
    );
    next[st.studentId] = {
      pointsEarned:
        existing?.pointsEarned != null
          ? String(existing.pointsEarned)
          : existing?.status === "missing"
            ? "0"
            : "",
      status: existing?.status ?? "scored",
      feedback: existing?.feedback ?? "",
    };
  }
  return next;
}

export function scoreDraftFromCell(
  scores: GradebookScoreRow[],
  assignmentId: string,
  studentId: string,
): ScoreDraftRow {
  const existing = scores.find(
    (s) => s.assignmentId === assignmentId && s.studentId === studentId,
  );
  if (!existing) return defaultScoreDraftRow();
  return {
    pointsEarned:
      existing.pointsEarned != null
        ? String(existing.pointsEarned)
        : existing.status === "missing"
          ? "0"
          : "",
    status: existing.status,
    feedback: existing.feedback ?? "",
  };
}

export function scoreDraftsEqual(
  a: Record<string, ScoreDraftRow>,
  b: Record<string, ScoreDraftRow>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const left = a[key];
    const right = b[key];
    if (!left || !right) return false;
    const ln = normalizeScoreDraftForCompare(left);
    const rn = normalizeScoreDraftForCompare(right);
    if (
      ln.pointsEarned !== rn.pointsEarned ||
      ln.status !== rn.status ||
      ln.feedback !== rn.feedback
    ) {
      return false;
    }
  }
  return true;
}

export function validateScoreDraft(
  draft: ScoreDraftRow,
  pointsPossible: number,
): string | null {
  if (draft.status === "missing" || draft.status === "exempt") {
    return null;
  }
  const parsed = parsePointsEarned(draft.pointsEarned, draft.status);
  if (parsed === "invalid") return "Enter a valid non-negative score.";
  if (parsed !== null && parsed > pointsPossible) {
    return `Score cannot exceed ${pointsPossible} points.`;
  }
  return null;
}

/** One pasted line → draft, or null if the line is invalid. */
export function parseScorePasteLine(line: string): ScoreDraftRow | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return { pointsEarned: "0", status: "missing", feedback: "" };
  }
  const upper = trimmed.toUpperCase();
  if (upper === "M") {
    return { pointsEarned: "0", status: "missing", feedback: "" };
  }
  if (upper === "A") {
    return { pointsEarned: "", status: "absent", feedback: "" };
  }
  const n = Number(trimmed);
  if (Number.isNaN(n) || n < 0) return null;
  return { pointsEarned: String(n), status: "scored", feedback: "" };
}

/** Excel/Sheets column paste: one value per line. */
export function parseScorePasteColumn(
  text: string,
): ScoreDraftRow[] | "invalid" {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  const drafts: ScoreDraftRow[] = [];
  for (const line of lines) {
    const draft = parseScorePasteLine(line);
    if (draft === null) return "invalid";
    drafts.push(draft);
  }
  return drafts;
}

export function scoreDraftsDirty(
  draft: ScoreDraftRow,
  server: ScoreDraftRow,
): boolean {
  const d = normalizeScoreDraftForCompare(draft);
  const s = normalizeScoreDraftForCompare(server);
  return (
    d.pointsEarned !== s.pointsEarned ||
    d.status !== s.status ||
    d.feedback !== s.feedback
  );
}

export function statusAbbrev(status: ScoreStatus): string {
  switch (status) {
    case "missing":
      return "M";
    case "absent":
      return "A";
    case "exempt":
      return "E";
    default:
      return "";
  }
}

export function mergeOneSavedScore(
  scores: GradebookScoreRow[],
  assignmentId: string,
  row: {
    studentId: string;
    pointsEarned: number | null;
    status: ScoreStatus;
    feedback: string | null;
  },
): GradebookScoreRow[] {
  return mergeSavedScores(scores, assignmentId, [row]);
}

export function mergeSavedScores(
  scores: GradebookScoreRow[],
  assignmentId: string,
  rows: { studentId: string; pointsEarned: number | null; status: ScoreStatus; feedback: string | null }[],
): GradebookScoreRow[] {
  const byKey = new Map(scores.map((s) => [scoreKey(s.assignmentId, s.studentId), s]));
  for (const row of rows) {
    const key = scoreKey(assignmentId, row.studentId);
    const existing = byKey.get(key);
    const next: GradebookScoreRow = {
      id: existing?.id ?? `local-${key}`,
      assignmentId,
      studentId: row.studentId,
      pointsEarned: row.pointsEarned,
      status: row.status,
      feedback: row.feedback,
    };
    byKey.set(key, next);
  }
  return Array.from(byKey.values());
}
