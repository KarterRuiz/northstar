"use client";

import Link from "next/link";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { quickReasonLabel } from "@/lib/student-support/quick-reasons";
import { cn } from "@/lib/utils";

import type { BehaviorLogRow } from "./load-behavior-page-data";
import { behaviorTypeToSupportCategory, type BehaviorType } from "./schema";
import type { SupportMomentCategory } from "./schema";

const MAX_TAG_CHIPS = 4;
/** Heuristic: show expand when summary is likely clamped. */
const EXPAND_THRESHOLD_CHARS = 160;

export type ClassroomMemoryTypeFilter = "all" | "positive" | "concern" | "strategy" | "parent";

export type ClassroomMemoryTimeFilter = "week" | "month" | "all";

/** Board-style bucket for filtering (maps support_category / behavior_type). */
export function memoryTypeBucket(row: BehaviorLogRow): Exclude<ClassroomMemoryTypeFilter, "all"> {
  const cat: SupportMomentCategory | null =
    row.supportCategory ?? behaviorTypeToSupportCategory(row.behaviorType);
  const t: BehaviorType = row.behaviorType;

  if (cat === "positive_recognition" || t === "positive_recognition") return "positive";
  if (
    cat === "quick_concern" ||
    t === "classroom_concern" ||
    t === "behavior_incident"
  ) {
    return "concern";
  }
  if (cat === "parent_communication" || t === "parent_contact") return "parent";
  return "strategy";
}

const memoryTypeShortLabel: Record<Exclude<ClassroomMemoryTypeFilter, "all">, string> = {
  positive: "Positive",
  concern: "Concern",
  strategy: "Strategy",
  parent: "Parent",
};

function effectiveCategory(row: BehaviorLogRow): SupportMomentCategory {
  return (
    row.supportCategory ??
    behaviorTypeToSupportCategory(row.behaviorType) ??
    "quick_concern"
  );
}

function quickReasonDisplay(row: BehaviorLogRow): string | null {
  if (!row.quickReason?.trim()) return null;
  return quickReasonLabel(effectiveCategory(row), row.quickReason.trim());
}

function tagChipLabel(row: BehaviorLogRow, tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return tag;
  return quickReasonLabel(effectiveCategory(row), trimmed);
}

function summaryBody(row: BehaviorLogRow): string {
  const g = row.generatedSummary?.trim();
  if (g) return g;
  return row.title?.trim() || "—";
}

function formatShortAbsolute(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function primaryTimestamp(row: BehaviorLogRow): string {
  if (row.createdAt && !Number.isNaN(Date.parse(row.createdAt))) return row.createdAt;
  return `${row.behaviorDate}T12:00:00.000Z`;
}

function formatRelativeAgo(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const diffSec = Math.round((Date.now() - ms) / 1000);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWk = Math.round(diffDay / 7);
  if (diffWk < 5) return `${diffWk}w ago`;
  const diffMo = Math.round(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  return `${Math.round(diffDay / 365)}y ago`;
}

function typeAccentClass(bucket: Exclude<ClassroomMemoryTypeFilter, "all">): string {
  switch (bucket) {
    case "positive":
      return "border-sky-400/35 bg-sky-500/[0.07] text-sky-950 dark:text-sky-100";
    case "concern":
      return "border-amber-500/35 bg-amber-500/[0.08] text-amber-950 dark:text-amber-50";
    case "parent":
      return "border-violet-400/35 bg-violet-500/[0.08] text-violet-950 dark:text-violet-50";
    default:
      return "border-emerald-400/30 bg-emerald-500/[0.07] text-emerald-950 dark:text-emerald-50";
  }
}

type ClassroomMemoryFeedProps = {
  rows: BehaviorLogRow[];
  /** Count before memory toolbar filters (search / type / time). */
  sourceRowCount: number;
  studentProfileBasePath?: string;
};

export function ClassroomMemoryFeed({
  rows,
  sourceRowCount,
  studentProfileBasePath = "/dashboard/teacher/students",
}: ClassroomMemoryFeedProps) {
  if (sourceRowCount === 0) {
    return (
      <p className="text-muted-foreground px-1 py-6 text-center text-sm leading-relaxed">
        No support moments yet. Use quick actions on a student card to begin building classroom memory.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground px-1 py-6 text-center text-sm leading-relaxed">
        No moments match these filters.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <ClassroomMemoryCard
          key={row.id}
          row={row}
          studentProfileBasePath={studentProfileBasePath}
        />
      ))}
    </ul>
  );
}

function ClassroomMemoryCard({
  row,
  studentProfileBasePath,
}: {
  row: BehaviorLogRow;
  studentProfileBasePath: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const bucket = memoryTypeBucket(row);
  const typeLabel = memoryTypeShortLabel[bucket];
  const reason = quickReasonDisplay(row);
  const body = summaryBody(row);
  const ts = primaryTimestamp(row);
  const relative = formatRelativeAgo(ts);
  const absoluteHint = row.createdAt
    ? formatShortAbsolute(row.createdAt)
    : formatDateOnly(row.behaviorDate);
  const showParentBadge =
    row.parentContacted === true ||
    row.supportCategory === "parent_communication" ||
    row.behaviorType === "parent_contact";
  const tags = row.supportTags.filter(Boolean);
  const visibleTags = tags.slice(0, MAX_TAG_CHIPS);
  const overflow = tags.length - visibleTags.length;

  return (
    <li
      className={cn(
        "border-border/55 bg-card/75 rounded-xl border p-4 shadow-sm backdrop-blur-[2px]",
        "transition-shadow hover:shadow-md",
      )}
    >
      <article className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={`${studentProfileBasePath}/${row.studentId}/behavior`}
                className="text-primary truncate text-sm font-semibold tracking-tight underline-offset-4 hover:underline"
              >
                {row.displayName}
              </Link>
              <Badge
                variant="outline"
                className={cn("shrink-0 text-[11px] font-medium", typeAccentClass(bucket))}
              >
                {typeLabel}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              <span className="font-medium text-foreground/80">{relative}</span>
              {absoluteHint ? (
                <span className="tabular-nums">
                  {" "}
                  · {absoluteHint}
                </span>
              ) : null}
              {row.recordedByName ? (
                <span>
                  {" "}
                  · <span className="text-foreground/85">{row.recordedByName}</span>
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {row.followUpRequired ? (
              <Badge variant="secondary" className="text-[11px] font-medium">
                Follow-up needed
              </Badge>
            ) : null}
            {showParentBadge ? (
              <Badge variant="outline" className="text-[11px] font-medium">
                Parent contact
              </Badge>
            ) : null}
          </div>
        </div>

        {reason ? (
          <p className="text-muted-foreground text-xs font-medium">
            Reason: <span className="text-foreground/90 font-semibold">{reason}</span>
          </p>
        ) : null}

        <div className="space-y-1.5">
          <p
            className={cn(
              "text-foreground text-[15px] leading-relaxed",
              !expanded && "line-clamp-3",
            )}
          >
            {body}
          </p>
          {body.length > EXPAND_THRESHOLD_CHARS ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-2 h-7 px-2 text-xs"
              aria-expanded={expanded}
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Show less" : "Show more"}
            </Button>
          ) : null}
        </div>

        {visibleTags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="bg-muted/70 text-muted-foreground border-border/40 rounded-md border px-2 py-0.5 text-[11px] font-medium"
              >
                {tagChipLabel(row, tag)}
              </span>
            ))}
            {overflow > 0 ? (
              <span className="text-muted-foreground text-[11px] font-medium">+{overflow}</span>
            ) : null}
          </div>
        ) : null}
      </article>
    </li>
  );
}
