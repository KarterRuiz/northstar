"use client";

import Link from "next/link";
import {
  Brain,
  MessageCircleWarning,
  MessagesSquare,
  Puzzle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { quickReasonLabel, supportMomentCategoryLabels } from "@/lib/student-support/quick-reasons";
import { cn } from "@/lib/utils";

import type { BehaviorLogRow } from "./load-behavior-page-data";
import {
  behaviorTypeLabels,
  behaviorTypeToSupportCategory,
  supportLevelLabels,
  type BehaviorSeverity,
  type BehaviorType,
  type SupportMomentCategory,
} from "./schema";

function supportLevelClassName(severity: BehaviorSeverity): string {
  if (severity === "positive") {
    return "border-sky-400/45 bg-sky-500/10 text-sky-950 dark:text-sky-100";
  }
  if (severity === "high") {
    return "border-amber-600/40 bg-amber-500/12 text-amber-950 dark:text-amber-50";
  }
  if (severity === "medium") {
    return "border-amber-400/45 bg-amber-400/10 text-amber-950 dark:text-amber-50";
  }
  return "border-slate-400/35 bg-slate-500/10 text-slate-800 dark:text-slate-100";
}

function formatTimelineDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function momentTypeLabel(row: BehaviorLogRow): string {
  if (row.supportCategory) {
    return supportMomentCategoryLabels[row.supportCategory];
  }
  return behaviorTypeLabels[row.behaviorType];
}

function quickReasonDisplay(row: BehaviorLogRow): string | null {
  if (!row.quickReason?.trim()) return null;
  const cat =
    row.supportCategory ?? behaviorTypeToSupportCategory(row.behaviorType) ?? "quick_concern";
  return quickReasonLabel(cat, row.quickReason.trim());
}

function TypeIcon({ row }: { row: BehaviorLogRow }) {
  const cat: SupportMomentCategory | null = row.supportCategory;
  const t: BehaviorType = row.behaviorType;
  const Icon =
    cat === "positive_recognition" || t === "positive_recognition"
      ? Sparkles
      : cat === "quick_concern" || t === "classroom_concern" || t === "behavior_incident"
        ? MessageCircleWarning
        : cat === "parent_communication" || t === "parent_contact"
          ? MessagesSquare
          : cat === "sel_observation" || t === "social_emotional"
            ? Brain
            : cat === "support_strategy" || t === "participation"
              ? Puzzle
              : cat === "intervention_followup" || t === "intervention_followup"
                ? RefreshCw
                : Puzzle;
  return (
    <span
      className="bg-muted/50 text-muted-foreground mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl"
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  );
}

type BehaviorTimelineProps = {
  rows: BehaviorLogRow[];
  studentProfileBasePath?: string;
  emptyMessage?: string;
};

export function BehaviorTimeline({
  rows,
  studentProfileBasePath = "/dashboard/teacher/students",
  emptyMessage = "No support moments match these filters yet. Log a quick note when something worth remembering happens.",
}: BehaviorTimelineProps) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground px-1 py-2 text-sm">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-4">
      {rows.map((row) => {
        const body = row.generatedSummary?.trim() || row.title;
        const subNote = row.teacherNote?.trim() || row.description?.trim();
        return (
          <li
            key={row.id}
            className="border-border/50 bg-card/40 flex gap-3 rounded-2xl border p-4 shadow-sm"
          >
            <TypeIcon row={row} />
            <article className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`${studentProfileBasePath}/${row.studentId}/behavior`}
                      className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      {row.displayName}
                    </Link>
                    <span className="text-muted-foreground text-xs">{row.classLabel}</span>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    <time dateTime={row.behaviorDate} className="font-medium tabular-nums">
                      {formatTimelineDate(row.behaviorDate)}
                    </time>
                    {row.createdAt ? (
                      <span className="tabular-nums">{formatTime(row.createdAt)}</span>
                    ) : null}
                    {row.recordedByName ? (
                      <span className="text-foreground/80">· {row.recordedByName}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Badge variant="outline" className="text-xs font-normal">
                    {momentTypeLabel(row)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-normal", supportLevelClassName(row.severity))}
                  >
                    {supportLevelLabels[row.severity]}
                  </Badge>
                  {row.followUpRequired ? (
                    <Badge variant="secondary" className="text-xs">
                      Follow-up
                    </Badge>
                  ) : null}
                </div>
              </div>

              <p className="text-foreground text-[15px] leading-relaxed">{body}</p>

              {row.quickReason ? (
                <p className="text-muted-foreground text-xs">
                  Quick tag:{" "}
                  <span className="text-foreground/85 font-medium">
                    {quickReasonDisplay(row)}
                  </span>
                  {row.timeOfDay ? (
                    <span>
                      {" "}
                      · <span className="text-foreground/80">{row.timeOfDay}</span>
                    </span>
                  ) : null}
                  {row.relatedSubject ? (
                    <span>
                      {" "}
                      · <span className="text-foreground/80">{row.relatedSubject}</span>
                    </span>
                  ) : null}
                </p>
              ) : null}

              {row.supportTags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {row.supportTags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-muted/60 text-muted-foreground rounded-md px-2 py-0.5 text-[11px] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {subNote && subNote !== body ? (
                <p className="text-muted-foreground border-border/40 border-t pt-2 text-sm leading-relaxed">
                  <span className="text-foreground/80 font-medium">Teacher note: </span>
                  {subNote}
                </p>
              ) : null}

              {row.actionTaken?.trim() ? (
                <p className="text-muted-foreground text-xs">
                  <span className="text-foreground/80 font-medium">Support offered: </span>
                  {row.actionTaken}
                </p>
              ) : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}
