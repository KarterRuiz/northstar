"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import type { ClassSupportClimateSummary } from "./support-board-insights";
import { SupportBoardInsightTrendBadge } from "./support-board-insight-trend";
import type { ClassroomSupportSnapshot } from "./support-board-classroom-snapshot";

type SupportBoardClassroomSnapshotPanelProps = {
  classroomSnapshot: ClassroomSupportSnapshot;
  classInsight: ClassSupportClimateSummary;
};

const StatTile = React.memo(function StatTile(props: {
  label: string;
  value: string | number;
  sub?: string | null;
  tone: "slate" | "sky" | "amber";
}) {
  const toneClasses =
    props.tone === "sky"
      ? "border-sky-200/70 bg-sky-50/50 text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/25 dark:text-sky-100"
      : props.tone === "amber"
        ? "border-amber-200/70 bg-amber-50/40 text-amber-950 dark:border-amber-900/45 dark:bg-amber-950/20 dark:text-amber-50"
        : "border-slate-200/80 bg-slate-50/60 text-slate-900 dark:border-slate-700/80 dark:bg-slate-900/30 dark:text-slate-100";

  return (
    <div
      className={cn(
        "flex min-h-[4.25rem] min-w-0 flex-col justify-center rounded-xl border px-3 py-2.5 shadow-sm",
        toneClasses,
        "transform-gpu transition-[transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        "motion-reduce:transition-none motion-reduce:will-change-auto motion-reduce:hover:translate-y-0",
        "hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/5 dark:hover:shadow-black/25",
        "motion-reduce:hover:shadow-sm",
      )}
    >
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{props.label}</p>
      <p className="text-lg font-semibold tabular-nums tracking-tight">{props.value}</p>
      {props.sub ? (
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-snug">{props.sub}</p>
      ) : null}
    </div>
  );
});

export function SupportBoardClassroomSnapshotPanel({
  classroomSnapshot: snapshot,
  classInsight,
}: SupportBoardClassroomSnapshotPanelProps) {
  const p0 = classInsight.patterns[0]?.label;
  const stripPattern =
    p0 &&
    !classInsight.statHighlights.some((h) => h.includes(p0) || p0.includes(h))
      ? p0
      : null;

  return (
    <section
      aria-labelledby="classroom-snapshot-heading"
      className="border-border/50 from-slate-50/90 via-sky-50/25 to-amber-50/20 dark:from-slate-950/80 dark:via-slate-900/40 dark:to-slate-950/80 space-y-3 rounded-2xl border bg-gradient-to-br p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 id="classroom-snapshot-heading" className="text-foreground text-base font-semibold tracking-tight">
          Classroom snapshot
        </h2>
        <p className="text-muted-foreground text-xs font-medium">
          Week of {snapshot.weekStart} – {snapshot.weekEnd} (UTC)
        </p>
      </div>

      <div
        role="region"
        aria-label="Class support climate summary"
        className={cn(
          "flex flex-col gap-2 rounded-xl border border-slate-200/60 bg-white/50 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1.5 sm:px-3.5 dark:border-slate-700/60 dark:bg-slate-950/30",
        )}
      >
        <p className="text-foreground/90 min-w-0 text-[11px] font-medium leading-snug sm:text-xs">
          <span className="text-muted-foreground font-normal">Class climate · </span>
          {classInsight.climateLabel}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SupportBoardInsightTrendBadge direction={classInsight.trendDirection} variant="compact" />
          {classInsight.statHighlights.map((s) => (
            <span
              key={s}
              className="text-muted-foreground text-[10px] font-medium leading-none sm:text-[11px]"
            >
              · {s}
            </span>
          ))}
        </div>
        {stripPattern ? (
          <p className="text-muted-foreground w-full text-[10px] leading-snug sm:text-[11px]">{stripPattern}</p>
        ) : null}
      </div>

      {snapshot.lowData ? (
        <p className="text-muted-foreground border-border/40 bg-card/40 rounded-lg border px-3 py-2 text-sm leading-relaxed">
          Support patterns will appear as teachers log quick moments.
        </p>
      ) : null}

      {!snapshot.lowData && snapshot.insightLine ? (
        <p className="text-foreground/90 text-sm leading-relaxed">{snapshot.insightLine}</p>
      ) : null}

      <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        <StatTile
          tone="sky"
          label="Positive moments"
          value={snapshot.positiveMomentsThisWeek}
          sub="This week"
        />
        <StatTile
          tone="amber"
          label="Follow-up roster"
          value={snapshot.studentsNeedingFollowUp}
          sub="Distinct students, last 14d"
        />
        <StatTile
          tone="sky"
          label="Top strength"
          value={snapshot.topStrengthLabel ?? "—"}
          sub="From positive moments"
        />
        <StatTile
          tone="slate"
          label="Top support area"
          value={snapshot.topSupportAreaLabel ?? "—"}
          sub="From concern moments"
        />
        <StatTile
          tone="slate"
          label="Parent contacts"
          value={snapshot.parentContactsThisWeek}
          sub="Logged this week"
        />
        <StatTile
          tone="sky"
          label="Strategies"
          value={snapshot.strategiesThisWeek}
          sub="This week"
        />
      </div>

    </section>
  );
}
