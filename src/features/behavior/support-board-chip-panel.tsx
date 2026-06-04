"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  supportBoardActionLabels,
  supportBoardChipButtonClass,
  type SupportBoardAction,
} from "./support-board-chips";
import { getSuggestions, type SupportBoardSuggestionContext } from "./support-board-suggestions";

type SupportBoardChipPanelProps = {
  action: SupportBoardAction;
  studentName: string;
  /** Unique prefix for textarea id (e.g. student id). */
  idPrefix: string;
  /** Optional class/student scope for future personalized ranking. */
  suggestionContext?: SupportBoardSuggestionContext;
  disabled?: boolean;
  note: string;
  onNoteChange: (v: string) => void;
  onChip: (quickReasonKey: string) => void;
  /** Inline tray: compact header (student name shown on card above). */
  variant?: "default" | "inline";
};

export function SupportBoardChipPanel({
  action,
  studentName,
  idPrefix,
  suggestionContext,
  disabled,
  note,
  onNoteChange,
  onChip,
  variant = "default",
}: SupportBoardChipPanelProps) {
  const inline = variant === "inline";
  /** Cleared when this panel remounts (overlay closes or action changes via `key` on parent). */
  const [showAllChips, setShowAllChips] = React.useState(false);

  const { suggested, all } = React.useMemo(
    () =>
      getSuggestions(action, {
        classId: suggestionContext?.classId,
        studentId: suggestionContext?.studentId,
      }),
    [action, suggestionContext?.classId, suggestionContext?.studentId],
  );
  const suggestedKeySet = React.useMemo(() => new Set(suggested.map((c) => c.key)), [suggested]);
  const hasMore = all.some((c) => !suggestedKeySet.has(c.key));
  const chips = showAllChips || !hasMore ? all : suggested;
  const chipGroupId = `support-board-chips-${idPrefix}-${action}`;

  return (
    <div className={cn("space-y-2.5", inline && "space-y-2")}>
      {inline ? (
        <>
          <span className="sr-only">
            {supportBoardActionLabels[action]} for {studentName}
          </span>
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            {supportBoardActionLabels[action]}
          </p>
        </>
      ) : (
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {supportBoardActionLabels[action]}
          </p>
          <p className="text-foreground mt-0.5 text-sm font-semibold leading-tight">{studentName}</p>
        </div>
      )}

      <div>
        <p id={`${chipGroupId}-legend`} className="sr-only">
          {hasMore && !showAllChips
            ? `Suggested quick reasons for ${supportBoardActionLabels[action]}`
            : `Quick reasons for ${supportBoardActionLabels[action]}`}
        </p>
        <div
          id={chipGroupId}
          role="group"
          aria-labelledby={`${chipGroupId}-legend`}
          className="flex flex-wrap items-stretch gap-1.5 sm:gap-2"
        >
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              disabled={disabled}
              aria-label={`Log ${c.label} for ${studentName}`}
              onClick={() => onChip(c.key)}
              className={supportBoardChipButtonClass(action)}
            >
              {c.label}
            </button>
          ))}
          {hasMore && !showAllChips ? (
            <button
              type="button"
              disabled={disabled}
              aria-expanded={false}
              aria-controls={chipGroupId}
              onClick={() => setShowAllChips(true)}
              className={cn(
                "inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full border border-dashed px-3 text-[11px] font-semibold sm:min-h-9 sm:px-2.5 sm:text-xs",
                "transform-gpu transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out motion-reduce:transition-colors",
                "border-slate-300/80 bg-white/50 text-slate-600 hover:border-slate-400 hover:bg-white/80 hover:text-slate-900 hover:shadow-sm hover:shadow-slate-500/10 motion-reduce:hover:shadow-none",
                "active:scale-[0.98] motion-reduce:active:scale-100",
                "focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-950/30 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-900/50 dark:hover:text-slate-50 dark:focus-visible:ring-slate-500/50",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              More
            </button>
          ) : null}
        </div>
      </div>

      <details className="group border-border/50 rounded-md border bg-white/60 px-1.5 py-0.5 dark:bg-slate-950/40">
        <summary className="text-muted-foreground flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md py-1 pr-0.5 text-[11px] font-medium select-none transition-[transform,color] duration-150 ease-out motion-reduce:transition-none active:scale-[0.99] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:outline-none sm:min-h-10 sm:text-xs dark:focus-visible:ring-slate-500/50 dark:focus-visible:ring-offset-slate-950 [&::-webkit-details-marker]:hidden">
          <ChevronDown
            aria-hidden
            className="size-3.5 shrink-0 transition-transform motion-reduce:transition-none group-open:rotate-180"
          />
          <span>Add optional note</span>
        </summary>
        <div className="pb-2 pt-1">
          <Label htmlFor={`support-note-${idPrefix}-${action}`} className="sr-only">
            Optional note
          </Label>
          <Textarea
            id={`support-note-${idPrefix}-${action}`}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={2}
            placeholder="One line for your future self (optional)"
            className="resize-none text-sm focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-slate-500/50 dark:focus-visible:ring-offset-slate-950"
          />
        </div>
      </details>
    </div>
  );
}
