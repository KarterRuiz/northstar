"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { assignmentPercent, formatPercent, type ScoreStatus } from "./calculations";
import type { GradebookAssignmentRow, GradebookStudentRow } from "./load-gradebook-data";
import { SCORE_STATUS_OPTIONS } from "./schema";
import {
  defaultScoreDraftRow,
  nextDraftForStatusChange,
  scoreDraftsEqual,
  selectClassName,
  type ScoreDraftRow,
} from "./gradebook-utils";
import { GradebookScoreStatusGlyph } from "./gradebook-score-status-glyph";

type GradebookScoreEntrySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: GradebookAssignmentRow | null;
  students: GradebookStudentRow[];
  serverScoreDraft: Record<string, ScoreDraftRow>;
  savePending: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  saveMessage: string | null;
  onSave: (draft: Record<string, ScoreDraftRow>) => Promise<boolean>;
};

export function GradebookScoreEntrySheet({
  open,
  onOpenChange,
  assignment,
  students,
  serverScoreDraft,
  savePending,
  saveState,
  saveMessage,
  onSave,
}: GradebookScoreEntrySheetProps) {
  const [scoreEdits, setScoreEdits] = React.useState<Record<string, ScoreDraftRow> | null>(
    null,
  );
  const [bulkApplyScore, setBulkApplyScore] = React.useState("");
  const [bulkApplyStatus, setBulkApplyStatus] =
    React.useState<ScoreStatus>("scored");

  const scoreDraft = scoreEdits ?? serverScoreDraft;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setScoreEdits(null);
      setBulkApplyScore("");
      setBulkApplyStatus("scored");
    }
    onOpenChange(next);
  };

  const handleSaveClick = async () => {
    const ok = await onSave(scoreDraft);
    if (ok) {
      setScoreEdits(null);
    }
  };
  const scoresDirty =
    scoreEdits !== null && !scoreDraftsEqual(scoreEdits, serverScoreDraft);

  const updateScoreDraft = (
    updater: (prev: Record<string, ScoreDraftRow>) => Record<string, ScoreDraftRow>,
  ) => {
    setScoreEdits((prev) => updater(prev ?? serverScoreDraft));
  };

  const applyBulkToAllStudents = (
    patch: (row: ScoreDraftRow) => ScoreDraftRow,
  ) => {
    updateScoreDraft((prev) => {
      const next = { ...prev };
      for (const st of students) {
        const current = next[st.studentId] ?? defaultScoreDraftRow();
        next[st.studentId] = patch(current);
      }
      return next;
    });
  };

  if (!assignment) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full max-h-[100dvh] w-[min(100%,36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle>Enter scores</SheetTitle>
          <SheetDescription>
            {assignment.title} · {assignment.pointsPossible} pts possible
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4">
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">Bulk actions</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savePending}
                onClick={() =>
                  applyBulkToAllStudents((row) => ({
                    ...row,
                    pointsEarned: String(assignment.pointsPossible),
                    status: "scored",
                  }))
                }
              >
                Full credit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savePending}
                onClick={() =>
                  applyBulkToAllStudents((row) => ({
                    ...row,
                    pointsEarned: "0",
                    status: "missing",
                  }))
                }
              >
                All missing
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savePending}
                onClick={() =>
                  applyBulkToAllStudents((row) => ({
                    ...row,
                    pointsEarned: "",
                    status: "absent",
                  }))
                }
              >
                All absent
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savePending}
                onClick={() => applyBulkToAllStudents(() => defaultScoreDraftRow())}
              >
                Clear
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2 border-t pt-3">
              <div className="space-y-1">
                <Label htmlFor="bulk-apply-score">Custom score for all</Label>
                <Input
                  id="bulk-apply-score"
                  type="number"
                  min={0}
                  step="0.01"
                  value={bulkApplyScore}
                  onChange={(e) => setBulkApplyScore(e.target.value)}
                  className="h-8 w-28 text-xs"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bulk-apply-status">Status</Label>
                <select
                  id="bulk-apply-status"
                  className={cn(selectClassName, "w-36")}
                  value={bulkApplyStatus}
                  onChange={(e) => setBulkApplyStatus(e.target.value as ScoreStatus)}
                >
                  {SCORE_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={savePending || !bulkApplyScore.trim()}
                onClick={() => {
                  const trimmed = bulkApplyScore.trim();
                  if (!trimmed) return;
                  const n = Number(trimmed);
                  if (Number.isNaN(n) || n < 0) return;
                  applyBulkToAllStudents((row) => {
                    if (bulkApplyStatus === "scored") {
                      return { ...row, status: "scored", pointsEarned: String(n) };
                    }
                    return nextDraftForStatusChange(row, bulkApplyStatus);
                  });
                }}
              >
                Apply
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto overscroll-x-contain rounded-lg border">
          <Table className="min-w-[28rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((st) => {
                const draft = scoreDraft[st.studentId] ?? defaultScoreDraftRow();
                const pct = assignmentPercent({
                  pointsPossible: assignment.pointsPossible,
                  pointsEarned: draft.pointsEarned ? Number(draft.pointsEarned) : null,
                  status: draft.status,
                });
                return (
                  <TableRow key={st.studentId}>
                    <TableCell className="font-medium">{st.displayName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <GradebookScoreStatusGlyph status={draft.status} />
                        <select
                          className={cn(selectClassName, "min-w-[7.5rem] flex-1")}
                          value={draft.status}
                          onChange={(e) =>
                            updateScoreDraft((prev) => {
                              const current =
                                prev[st.studentId] ?? defaultScoreDraftRow();
                              return {
                                ...prev,
                                [st.studentId]: nextDraftForStatusChange(
                                  current,
                                  e.target.value as ScoreStatus,
                                ),
                              };
                            })
                          }
                        >
                          {SCORE_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={assignment.pointsPossible}
                        step="0.01"
                        disabled={
                          draft.status === "missing" || draft.status === "exempt"
                        }
                        value={draft.pointsEarned}
                        placeholder={
                          draft.status === "absent" ? "Optional makeup" : undefined
                        }
                        onChange={(e) =>
                          updateScoreDraft((prev) => {
                            const cur = prev[st.studentId] ?? defaultScoreDraftRow();
                            return {
                              ...prev,
                              [st.studentId]: { ...cur, pointsEarned: e.target.value },
                            };
                          })
                        }
                        className="h-8 max-w-[5.5rem] text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatPercent(pct)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </div>

        <SheetFooter className="bg-background sticky bottom-0 shrink-0 border-t px-6 py-4">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <span
              className={cn(
                "text-xs",
                saveState === "error"
                  ? "text-destructive"
                  : saveState === "saved"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground",
              )}
              role="status"
            >
              {saveState === "saving" || savePending
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved successfully"
                  : saveState === "error"
                    ? saveMessage
                    : scoresDirty
                      ? "Unsaved changes"
                      : null}
            </span>
            <Button
              type="button"
              size="sm"
              disabled={savePending || !scoresDirty}
              onClick={() => void handleSaveClick()}
            >
              Save scores
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
