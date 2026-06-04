"use client";

import * as React from "react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MinimalMoment } from "@/lib/student-support/support-recommendations";
import { getSuggestedNextSupport } from "@/lib/student-support/support-recommendations";

import type { BehaviorLogRow } from "./load-behavior-page-data";
import type { BehaviorStudentOption } from "./schema";
import type { SupportBoardStudentSnapshot } from "./support-board-snapshot-types";
import {
  supportBoardActionLabels,
  supportBoardQuickActionButtonClass,
  type SupportBoardAction,
} from "./support-board-chips";
import { SupportBoardInsightTrendBadge } from "./support-board-insight-trend";
import type { StudentSupportInsight } from "./support-board-insights";
import {
  deriveSupportBoardMomentTags,
  lastSupportMomentFromRows,
  pickNewerMoment,
} from "./support-board-signals";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase() || "?";
}

function formatShortRelative(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${Math.max(1, months)}mo ago`;
}

/** Payload for persisting a quick support moment (used by the support board view). */
export type QuickSavePayload = {
  action: SupportBoardAction;
  quickReasonKey: string;
  teacherNote: string;
};

export type SupportBoardStudentCardProps = {
  student: BehaviorStudentOption;
  classId: string;
  classLabel: string;
  snapshot: SupportBoardStudentSnapshot;
  studentInsight: StudentSupportInsight;
  timelineRows: BehaviorLogRow[];
  supportMoments: MinimalMoment[];
  openTrayAction: SupportBoardAction | null;
  /** Opens or closes the global quick-action overlay; `anchorEl` is the pressed control for positioning. */
  onQuickActionPress: (action: SupportBoardAction, anchorEl: HTMLButtonElement) => void;
  /** When true, quick-action triggers are disabled (e.g. while a save is in flight). */
  quickActionsDisabled?: boolean;
};

/** Shared HUD-style micro-stat surface (grade / attendance). */
const hudStatClass =
  "inline-flex max-w-full items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums tracking-tight outline-none sm:text-[11px]";

function TagRow(props: {
  label: string;
  labelId: string;
  bucket: { visible: string[]; moreCount: number };
  chipClass: string;
  emptyHint: string;
}) {
  const { label, labelId, bucket, chipClass, emptyHint } = props;
  const hasAny = bucket.visible.length > 0 || bucket.moreCount > 0;

  return (
    <section aria-labelledby={labelId} className="min-w-0">
      <p
        id={labelId}
        className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase"
      >
        {label}
      </p>
      {!hasAny ? (
        <p className="text-muted-foreground line-clamp-2 text-[10px] leading-tight">{emptyHint}</p>
      ) : (
        <ul className="flex flex-wrap gap-1 sm:gap-1.5">
          {bucket.visible.map((s) => (
            <li
              key={s}
              title={s}
              className={cn(
                "max-w-full truncate rounded-md px-2 py-0.5 text-[10px] font-medium sm:text-[11px]",
                chipClass,
              )}
            >
              {s}
            </li>
          ))}
          {bucket.moreCount > 0 ? (
            <li className="text-muted-foreground px-0.5 py-0.5 text-[10px] font-medium tabular-nums">
              +{bucket.moreCount}
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function SupportBoardStudentCardInner({
  student,
  classId,
  classLabel,
  snapshot,
  studentInsight,
  timelineRows,
  supportMoments,
  openTrayAction,
  onQuickActionPress,
  quickActionsDisabled = false,
}: SupportBoardStudentCardProps) {
  const tags = React.useMemo(
    () => deriveSupportBoardMomentTags(timelineRows, student.id, classId),
    [timelineRows, student.id, classId],
  );

  const supportSuggestion = React.useMemo(
    () => getSuggestedNextSupport(supportMoments, new Date()),
    [supportMoments],
  );

  const lastMoment = React.useMemo(() => {
    const fromRows = lastSupportMomentFromRows(timelineRows, student.id, classId);
    return pickNewerMoment(snapshot.lastMoment, fromRows);
  }, [timelineRows, student.id, classId, snapshot.lastMoment]);

  const actions: SupportBoardAction[] = ["positive", "concern", "strategy", "parent"];

  const gradeBadge = snapshot.gradeLine ? (
    snapshot.gradePartial ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              hudStatClass,
              "cursor-default border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
              "focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
            )}
          >
            {snapshot.gradeLine} *
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          Partial grade — not every weighted category has entered scores yet.
        </TooltipContent>
      </Tooltip>
    ) : (
      <span
        className={cn(
          hudStatClass,
          "border-slate-200/90 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
        )}
      >
        {snapshot.gradeLine}
      </span>
    )
  ) : (
    <span
      className={cn(
        hudStatClass,
        "border-slate-200/70 bg-slate-50/90 text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400",
      )}
    >
      Grade —
    </span>
  );

  const attTooltip =
    snapshot.attendanceMarkedDays === 0
      ? "No attendance marked this term for this class."
      : snapshot.attendanceAtRisk
        ? `Attendance pattern flags a concern this term (${snapshot.attendancePercent ?? "—"}% attended where marked).`
        : `${snapshot.attendancePercent}% attended across ${snapshot.attendanceMarkedDays} marked day(s) this term.`;

  const attendanceBadge =
    snapshot.attendancePercent === null && !snapshot.attendanceAtRisk ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              hudStatClass,
              "cursor-default border-slate-200/90 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
              "focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
            )}
          >
            Att —
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {attTooltip}
        </TooltipContent>
      </Tooltip>
    ) : snapshot.attendanceAtRisk ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              hudStatClass,
              "cursor-default border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-900/45 dark:bg-amber-950/35 dark:text-amber-100",
              "focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
            )}
          >
            {snapshot.attendancePercent !== null ? `Att ${snapshot.attendancePercent}% · risk` : "Att · risk"}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {attTooltip}
        </TooltipContent>
      </Tooltip>
    ) : (
      <span
        className={cn(
          hudStatClass,
          "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100",
        )}
      >
        Att {snapshot.attendancePercent}%
      </span>
    );

  const parentMeta =
    snapshot.parentContactsThisTerm > 0 ? (
      <span
        className="text-muted-foreground max-w-[11rem] truncate text-[10px] font-medium tabular-nums sm:max-w-none"
        title={
          snapshot.parentLastBehaviorDate
            ? `${snapshot.parentContactsThisTerm} contacts · last ${snapshot.parentLastBehaviorDate}`
            : `${snapshot.parentContactsThisTerm} contacts this term`
        }
      >
        Parent · {snapshot.parentContactsThisTerm}
        {snapshot.parentLastBehaviorDate ? ` · ${snapshot.parentLastBehaviorDate}` : ""}
      </span>
    ) : (
      <span className="text-muted-foreground text-[10px] font-medium">Parent · —</span>
    );

  const lastMomentTitle = lastMoment
    ? `${lastMoment.preview} · ${formatShortRelative(lastMoment.atIso)}`
    : undefined;
  const lastMomentKey = lastMoment ? `${lastMoment.atIso}:${lastMoment.preview}` : "none";
  const lastLine = lastMoment ? (
    <p
      key={lastMomentKey}
      className="text-foreground/90 line-clamp-1 text-[10px] leading-tight motion-safe:animate-support-content-swap sm:line-clamp-2 sm:text-[11px] sm:leading-snug"
      title={lastMomentTitle}
    >
      {lastMoment.preview}
      <span className="text-muted-foreground"> · {formatShortRelative(lastMoment.atIso)}</span>
    </p>
  ) : (
    <p className="text-muted-foreground text-[10px] sm:text-[11px]">No recent moments</p>
  );

  const sid = student.id;

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 shadow-sm",
        "dark:border-slate-700/80 dark:bg-slate-950/50",
        "ring-slate-200/50 ring-1 dark:ring-slate-800/80",
        "transform-gpu transition-[transform,box-shadow] duration-[200ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        "motion-reduce:transition-none motion-reduce:will-change-auto motion-reduce:hover:translate-y-0",
        "hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/6 dark:hover:shadow-black/35",
        "motion-reduce:hover:shadow-sm active:translate-y-0 active:scale-[0.998] active:shadow-sm",
        "motion-reduce:active:scale-100",
      )}
    >
      <div className="flex flex-col p-3 sm:p-4">
        <header className="flex gap-2.5 border-b border-slate-100/90 pb-2.5 dark:border-slate-800/80">
          <Avatar className="size-9 shrink-0 border border-slate-200/80 dark:border-slate-700">
            <AvatarFallback className="bg-sky-100 text-xs font-semibold text-sky-900 dark:bg-sky-950/60 dark:text-sky-100">
              {initialsFromName(student.label)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="min-w-0 truncate text-sm font-semibold tracking-tight sm:text-[15px]">
              <Link
                href={`/dashboard/teacher/students/${student.id}/behavior`}
                className="text-foreground block truncate underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950"
              >
                {student.label}
              </Link>
            </h3>
            <p className="text-muted-foreground truncate text-[11px] leading-none">{classLabel}</p>
            <div
              className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-0.5"
              role="group"
              aria-label="Grade, attendance, and parent contacts this term"
            >
              {gradeBadge}
              {attendanceBadge}
              <span
                className="text-muted-foreground hidden h-3 w-px shrink-0 bg-slate-200 dark:bg-slate-700 sm:block"
                aria-hidden
              />
              <span className="min-w-0 sm:pl-0">{parentMeta}</span>
            </div>
            <div
              className="flex flex-wrap items-center gap-1 border-t border-slate-100/90 pt-1 dark:border-slate-800/70"
              role="status"
              aria-live="polite"
              aria-label={studentInsight.trendAriaLabel}
            >
              <SupportBoardInsightTrendBadge direction={studentInsight.trendDirection} />
              <p className="text-muted-foreground min-w-0 flex-1 text-[10px] leading-snug sm:text-[11px]">
                <span className="text-foreground/90 font-medium">{studentInsight.momentumLine}</span>
                {studentInsight.ratioLine ? (
                  <span className="text-muted-foreground"> · {studentInsight.ratioLine}</span>
                ) : null}
              </p>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid gap-3 py-2.5 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-2 sm:py-3">
            <TagRow
              label="Strengths"
              labelId={`support-board-${sid}-strengths`}
              bucket={tags.strengths}
              chipClass="bg-emerald-50/90 text-emerald-900 ring-1 ring-emerald-500/10 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-400/10"
              emptyHint="No patterns yet — log a moment to build this."
            />
            <TagRow
              label="Support areas"
              labelId={`support-board-${sid}-support`}
              bucket={tags.supportAreas}
              chipClass="bg-slate-100/90 text-slate-800 ring-1 ring-slate-500/10 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-500/15"
              emptyHint="No concern patterns logged."
            />
          </div>

          <div className="space-y-2.5 border-t border-dashed border-slate-200/70 py-2.5 dark:border-slate-800/80 sm:py-3">
            {supportSuggestion ? (
              <p
                key={supportSuggestion.label}
                className="text-muted-foreground line-clamp-1 text-[10px] leading-tight motion-safe:animate-support-content-swap sm:text-[11px]"
                title={`Suggested next step: ${supportSuggestion.label}`}
              >
                <span className="font-semibold text-sky-800 dark:text-sky-200/90">Next · </span>
                <span className="text-foreground/85">{supportSuggestion.label}</span>
              </p>
            ) : null}
            <TagRow
              label="Strategies tried"
              labelId={`support-board-${sid}-strategies`}
              bucket={tags.strategies}
              chipClass="bg-sky-50/90 text-sky-950 ring-1 ring-sky-500/10 dark:bg-sky-950/45 dark:text-sky-100 dark:ring-sky-400/10"
              emptyHint="No strategy moments yet."
            />
            <div className="border-t border-slate-100/90 pt-2 dark:border-slate-800/70">
              <p className="text-muted-foreground mb-0.5 text-[10px] font-semibold tracking-wider uppercase">
                Last moment
              </p>
              {lastLine}
            </div>
          </div>
        </div>

        <footer className="border-t border-slate-100 pt-3 dark:border-slate-800/80">
          <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
            Quick action
          </p>
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:gap-2">
            {actions.map((action) => {
              const label = supportBoardActionLabels[action];
              const selected = openTrayAction === action;

              return (
                <button
                  key={action}
                  type="button"
                  disabled={quickActionsDisabled}
                  aria-label={`${label} for ${student.label}`}
                  aria-expanded={selected}
                  aria-controls={selected ? "support-board-quick-overlay-panel" : undefined}
                  onClick={(e) => {
                    onQuickActionPress(action, e.currentTarget);
                  }}
                  className={supportBoardQuickActionButtonClass(action, selected)}
                >
                  <span className="w-full">{label}</span>
                </button>
              );
            })}
          </div>
        </footer>
      </div>
    </article>
  );
}

export const SupportBoardStudentCard = React.memo(SupportBoardStudentCardInner);
