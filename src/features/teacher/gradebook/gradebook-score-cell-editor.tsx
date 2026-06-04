"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  assignmentPercent,
  formatPercent,
  letterGradeFromPercent,
  type ScoreStatus,
} from "./calculations";
import { SCORE_STATUS_OPTIONS } from "./schema";
import type { GradebookAssignmentRow, GradebookScoreRow } from "./load-gradebook-data";
import {
  defaultScoreDraftRow,
  nextDraftForStatusChange,
  normalizeScoreDraftForCompare,
  scoreDraftsDirty,
  selectClassName,
  statusAbbrev,
  validateScoreDraft,
  type ScoreDraftRow,
} from "./gradebook-utils";
import { GradebookScoreStatusGlyph } from "./gradebook-score-status-glyph";
import {
  useGradebookGridNavigation,
  type CellCoord,
} from "./use-gradebook-grid-navigation";

type GradebookScoreCellEditorProps = {
  className?: string;
  assignment: GradebookAssignmentRow;
  studentId: string;
  rowIndex: number;
  colIndex: number;
  score?: GradebookScoreRow;
  saveState?: "saving" | "saved" | "error";
  onSave: (draft: ScoreDraftRow) => Promise<void>;
};

function saveStateLabel(state?: "saving" | "saved" | "error"): string | null {
  switch (state) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Error";
    default:
      return null;
  }
}

export const GradebookScoreCellEditor = React.memo(function GradebookScoreCellEditor({
  className,
  assignment,
  studentId,
  rowIndex,
  colIndex,
  score,
  saveState,
  onSave,
}: GradebookScoreCellEditorProps) {
  const navigation = useGradebookGridNavigation();
  const { registerCellElement } = navigation;
  const coord = React.useMemo(
    (): CellCoord => ({ rowIndex, colIndex }),
    [rowIndex, colIndex],
  );

  const isActive = navigation.isCellActive(coord);
  const isEditing = navigation.isCellEditing(coord);

  const serverDraft = React.useMemo(
    () =>
      score
        ? {
            pointsEarned:
              score.pointsEarned != null
                ? String(score.pointsEarned)
                : score.status === "missing"
                  ? "0"
                  : "",
            status: score.status,
            feedback: score.feedback ?? "",
          }
        : defaultScoreDraftRow(),
    [score],
  );
  const [draft, setDraft] = React.useState(serverDraft);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLTableCellElement>(null);
  const pointsRef = React.useRef<HTMLInputElement>(null);
  const clickTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = score?.status ?? "missing";
  const pct = assignmentPercent({
    pointsPossible: assignment.pointsPossible,
    pointsEarned: score?.pointsEarned ?? null,
    status,
  });

  const isScored = status === "scored" && pct !== null;
  const displayAbbrev = score && !isScored ? statusAbbrev(status) : null;

  const setCellRef = React.useCallback(
    (el: HTMLTableCellElement | null) => {
      rootRef.current = el;
      registerCellElement(coord, el);
    },
    [coord, registerCellElement],
  );

  React.useEffect(() => {
    if (!isEditing) {
      setDraft(serverDraft);
      setValidationError(null);
    }
  }, [isEditing, serverDraft]);

  React.useEffect(() => {
    if (isEditing && (draft.status === "scored" || draft.status === "absent")) {
      pointsRef.current?.focus();
      pointsRef.current?.select();
    }
  }, [isEditing, draft.status]);

  React.useEffect(() => {
    if (!isEditing) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      if (scoreDraftsDirty(draft, serverDraft)) {
        const discard = window.confirm(
          "Discard unsaved changes to this score?",
        );
        if (!discard) return;
      }
      navigation.stopEditing();
      setDraft(serverDraft);
      setValidationError(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [draft, isEditing, navigation, serverDraft]);

  const cancelEdit = () => {
    if (
      scoreDraftsDirty(draft, serverDraft) &&
      !window.confirm("Discard unsaved changes to this score?")
    ) {
      return;
    }
    navigation.stopEditing();
    setDraft(serverDraft);
    setValidationError(null);
  };

  const commit = async (moveDirection: "down" | "none" = "none") => {
    const unchanged =
      normalizeScoreDraftForCompare(draft).pointsEarned ===
        normalizeScoreDraftForCompare(serverDraft).pointsEarned &&
      draft.status === serverDraft.status;
    if (unchanged) {
      navigation.stopEditing();
      if (moveDirection === "down") navigation.moveAfterSave("down");
      return;
    }

    const validation = validateScoreDraft(draft, assignment.pointsPossible);
    if (validation) {
      setValidationError(validation);
      return;
    }

    setValidationError(null);
    await onSave(draft);
    navigation.stopEditing();
    if (moveDirection === "down") {
      navigation.moveAfterSave("down");
    }
  };

  const handleCellClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      navigation.selectCell(coord);
      navigation.startEditing(coord);
      return;
    }
    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null;
      navigation.selectCell(coord);
    }, 220);
  };

  const feedback = validationError ?? saveStateLabel(saveState);
  const saving = saveState === "saving";

  return (
    <td
      ref={setCellRef}
      className={cn(
        "border-border/60 relative border-b border-r p-0 align-middle",
        className,
        isActive && !isEditing && "ring-ring/60 ring-2 ring-inset",
        saveState === "saved" && "bg-emerald-500/10",
        saveState === "error" && "bg-destructive/10",
        status === "missing" && !isEditing && "text-amber-700 dark:text-amber-300",
        status === "absent" && !isEditing && "text-sky-800 dark:text-sky-200",
        !score && !isEditing && "text-muted-foreground",
      )}
      data-gradebook-row={rowIndex}
      data-gradebook-col={colIndex}
    >
      <div className="relative">
        <button
          type="button"
          tabIndex={isActive && !isEditing ? 0 : -1}
          className={cn(
            "hover:bg-muted/60 flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-center px-1.5 py-1 text-center text-[11px] tabular-nums outline-none",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1",
            isEditing && "bg-muted/50",
          )}
          onClick={handleCellClick}
          title="Click to select · double-click or Enter to edit"
          data-active={isActive || undefined}
          aria-expanded={isEditing}
          aria-haspopup="dialog"
        >
          {isScored ? (
            <span className="flex flex-col items-center leading-tight">
              <span className="font-medium">{formatPercent(pct, 0)}</span>
              <span className="text-muted-foreground text-[9px] font-normal">
                {letterGradeFromPercent(pct)}
              </span>
            </span>
          ) : displayAbbrev ? (
            <span className="text-[10px] font-medium tracking-wide uppercase">
              {displayAbbrev}
            </span>
          ) : (
            "—"
          )}
        </button>

        {isEditing ? (
          <div
            role="dialog"
            aria-label={`Edit score for ${assignment.title}`}
            className="bg-popover text-popover-foreground border-border/80 absolute top-full left-1/2 z-50 mt-0.5 w-[min(100vw-2rem,11.5rem)] min-w-[10.5rem] -translate-x-1/2 rounded-md border p-2 shadow-md"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                cancelEdit();
              }
            }}
          >
            <p className="text-muted-foreground mb-1.5 line-clamp-2 text-[9px] leading-tight">
              {assignment.title}
            </p>
            <div className="space-y-1.5">
              <label className="sr-only" htmlFor={`status-${assignment.id}-${studentId}`}>
                Status
              </label>
              <div className="flex items-center gap-1.5">
                <GradebookScoreStatusGlyph status={draft.status} />
                <select
                  id={`status-${assignment.id}-${studentId}`}
                  className={cn(selectClassName, "h-7 min-w-0 flex-1 text-[10px]")}
                  value={draft.status}
                  disabled={saving}
                  onChange={(e) => {
                    const nextStatus = e.target.value as ScoreStatus;
                    setDraft((d) => nextDraftForStatusChange(d, nextStatus));
                    setValidationError(null);
                  }}
                >
                  {SCORE_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="sr-only" htmlFor={`points-${assignment.id}-${studentId}`}>
                Points earned
              </label>
              <input
                ref={pointsRef}
                id={`points-${assignment.id}-${studentId}`}
                type="number"
                min={0}
                max={assignment.pointsPossible}
                step="0.01"
                disabled={
                  saving || draft.status === "missing" || draft.status === "exempt"
                }
                value={draft.pointsEarned}
                placeholder={
                  draft.status === "scored"
                    ? `0–${assignment.pointsPossible}`
                    : draft.status === "absent"
                      ? "Optional makeup"
                      : undefined
                }
                onChange={(e) => {
                  setDraft((d) => ({ ...d, pointsEarned: e.target.value }));
                  setValidationError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commit("down");
                  }
                }}
                className="border-input bg-background h-7 w-full rounded border px-1.5 text-[10px] outline-none focus-visible:ring-1"
              />
              {draft.status === "absent" ? (
                <p className="text-muted-foreground text-[9px] leading-tight">
                  Absent is not averaged until you mark Scored. Optional points can track
                  makeup work.
                </p>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-between gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px]"
                disabled={saving}
                onClick={cancelEdit}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-6 px-2 text-[10px]"
                disabled={saving}
                onClick={() => void commit("none")}
              >
                Save
              </Button>
            </div>
            {feedback ? (
              <p
                className={cn(
                  "mt-1 text-center text-[9px]",
                  validationError || saveState === "error"
                    ? "text-destructive"
                    : saveState === "saved"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground",
                )}
                aria-live="polite"
              >
                {feedback}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </td>
  );
});
