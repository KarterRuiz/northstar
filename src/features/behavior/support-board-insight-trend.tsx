"use client";

import { cn } from "@/lib/utils";

import type { SupportMomentTrendDirection } from "./support-board-insights";
import {
  supportMomentTrendGlyphs,
  supportMomentTrendLabels,
} from "./support-board-insights";
import type { WeeklyTrendDirection } from "./support-board-insights";

const toneByDirection: Record<
  SupportMomentTrendDirection,
  string
> = {
  improving:
    "border-emerald-200/70 bg-emerald-50/50 text-emerald-900 shadow-[0_0_0_1px_rgba(16,185,129,0.08)] dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-50",
  needs_support:
    "border-sky-200/80 bg-sky-50/60 text-sky-950 shadow-[0_0_0_1px_rgba(14,165,233,0.08)] dark:border-sky-900/45 dark:bg-sky-950/30 dark:text-sky-50",
  stable:
    "border-slate-200/80 bg-slate-50/70 text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-200",
};

function normalizeWeeklyTrend(t: WeeklyTrendDirection): SupportMomentTrendDirection {
  if (t === "insufficient_data") return "stable";
  return t;
}

type SupportBoardInsightTrendBadgeProps = {
  direction: SupportMomentTrendDirection | WeeklyTrendDirection;
  /** When true, shows glyph + label (card). When false, compact for strip. */
  variant?: "compact" | "default";
  className?: string;
};

export function SupportBoardInsightTrendBadge({
  direction: raw,
  variant = "default",
  className,
}: SupportBoardInsightTrendBadgeProps) {
  const direction = normalizeWeeklyTrend(raw);
  const label = supportMomentTrendLabels[direction];
  const glyph = supportMomentTrendGlyphs[direction];
  const aria =
    raw === "insufficient_data"
      ? "Recent trend: early signals, stable for now"
      : `Recent trend: ${label}`;

  if (variant === "compact") {
    return (
      <span aria-label={aria} className={cn("inline-flex", className)}>
        <span
          aria-hidden
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-none",
            toneByDirection[direction],
          )}
        >
          <span className="select-none">{glyph}</span>
          <span>{label}</span>
        </span>
      </span>
    );
  }

  return (
    <span aria-label={aria} className={cn("inline-flex", className)}>
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums leading-none",
          toneByDirection[direction],
        )}
      >
        <span className="select-none text-[12px]">{glyph}</span>
        <span>{label}</span>
      </span>
    </span>
  );
}
