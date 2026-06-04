import type { SupportMomentCategory } from "@/lib/student-support/quick-reasons";
import { cn } from "@/lib/utils";

/** Primary board actions — maps to `support_category` + `quick_reason` keys. */
export type SupportBoardAction = "positive" | "concern" | "strategy" | "parent";

export type SupportBoardChip = {
  /** Stored as `quick_reason` / tag key (must exist in `quickReasonsByCategory`). */
  key: string;
  /** Teacher-facing chip label (may differ from `quickReasonLabel` for brevity). */
  label: string;
};

const quickActionSurface: Record<
  SupportBoardAction,
  { idle: string; selected: string; focusRing: string; hoverGlow: string }
> = {
  positive: {
    idle:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-950 hover:bg-emerald-500/14 hover:border-emerald-500/35 dark:border-emerald-400/30 dark:bg-emerald-500/12 dark:text-emerald-50 dark:hover:bg-emerald-500/18",
    selected:
      "border-emerald-500/45 bg-emerald-500/18 text-emerald-950 ring-2 ring-emerald-500/35 dark:border-emerald-400/50 dark:bg-emerald-500/22 dark:text-emerald-50 dark:ring-emerald-400/35",
    focusRing: "focus-visible:ring-emerald-500/45",
    hoverGlow:
      "hover:shadow-md hover:shadow-emerald-600/12 dark:hover:shadow-emerald-500/18 aria-expanded:shadow-md aria-expanded:shadow-emerald-600/14 dark:aria-expanded:shadow-emerald-500/22",
  },
  concern: {
    idle:
      "border-amber-500/30 bg-amber-500/10 text-amber-950 hover:bg-amber-500/14 hover:border-amber-500/40 dark:border-amber-400/35 dark:bg-amber-500/12 dark:text-amber-50 dark:hover:bg-amber-500/18",
    selected:
      "border-amber-500/50 bg-amber-500/18 text-amber-950 ring-2 ring-amber-500/35 dark:border-amber-400/55 dark:bg-amber-500/22 dark:text-amber-50 dark:ring-amber-400/35",
    focusRing: "focus-visible:ring-amber-500/45",
    hoverGlow:
      "hover:shadow-md hover:shadow-amber-600/14 dark:hover:shadow-amber-500/18 aria-expanded:shadow-md aria-expanded:shadow-amber-600/16 dark:aria-expanded:shadow-amber-500/22",
  },
  strategy: {
    idle:
      "border-sky-500/30 bg-sky-500/10 text-sky-950 hover:bg-sky-500/14 hover:border-sky-500/40 dark:border-sky-400/35 dark:bg-sky-500/12 dark:text-sky-50 dark:hover:bg-sky-500/18",
    selected:
      "border-sky-500/50 bg-sky-500/18 text-sky-950 ring-2 ring-sky-500/35 dark:border-sky-400/55 dark:bg-sky-500/22 dark:text-sky-50 dark:ring-sky-400/35",
    focusRing: "focus-visible:ring-sky-500/45",
    hoverGlow:
      "hover:shadow-md hover:shadow-sky-600/12 dark:hover:shadow-sky-400/18 aria-expanded:shadow-md aria-expanded:shadow-sky-600/14 dark:aria-expanded:shadow-sky-400/22",
  },
  parent: {
    idle:
      "border-violet-500/30 bg-violet-500/10 text-violet-950 hover:bg-violet-500/14 hover:border-violet-500/40 dark:border-violet-400/35 dark:bg-violet-500/12 dark:text-violet-50 dark:hover:bg-violet-500/18",
    selected:
      "border-violet-500/50 bg-violet-500/18 text-violet-950 ring-2 ring-violet-500/35 dark:border-violet-400/55 dark:bg-violet-500/22 dark:text-violet-50 dark:ring-violet-400/35",
    focusRing: "focus-visible:ring-violet-500/45",
    hoverGlow:
      "hover:shadow-md hover:shadow-violet-600/12 dark:hover:shadow-violet-400/18 aria-expanded:shadow-md aria-expanded:shadow-violet-600/14 dark:aria-expanded:shadow-violet-400/22",
  },
};

/** Styles for the four primary quick-action triggers on the support board. */
export function supportBoardQuickActionButtonClass(
  action: SupportBoardAction,
  selected: boolean,
): string {
  const tone = quickActionSurface[action];
  return cn(
    "inline-flex w-full min-h-11 flex-col items-stretch justify-center gap-0.5 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold leading-snug tracking-tight sm:text-sm",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out",
    "motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
    tone.focusRing,
    "disabled:pointer-events-none disabled:opacity-50",
    "touch-manipulation active:scale-[0.99] motion-reduce:active:scale-100",
    selected ? tone.selected : tone.idle,
    tone.hoverGlow,
  );
}

const chipToneByAction: Record<SupportBoardAction, string> = {
  positive:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 hover:bg-emerald-500/14 hover:shadow-sm hover:shadow-emerald-600/10 focus-visible:ring-emerald-500/45 dark:border-emerald-400/35 dark:bg-emerald-500/12 dark:text-emerald-50 dark:hover:bg-emerald-500/16 dark:hover:shadow-emerald-500/14",
  concern:
    "border-amber-500/35 bg-amber-500/10 text-amber-950 hover:bg-amber-500/14 hover:shadow-sm hover:shadow-amber-600/12 focus-visible:ring-amber-500/45 dark:border-amber-400/40 dark:bg-amber-500/12 dark:text-amber-50 dark:hover:bg-amber-500/16 dark:hover:shadow-amber-500/14",
  strategy:
    "border-sky-500/35 bg-sky-500/10 text-sky-950 hover:bg-sky-500/14 hover:shadow-sm hover:shadow-sky-600/10 focus-visible:ring-sky-500/45 dark:border-sky-400/40 dark:bg-sky-500/12 dark:text-sky-50 dark:hover:bg-sky-500/16 dark:hover:shadow-sky-400/14",
  parent:
    "border-violet-500/35 bg-violet-500/10 text-violet-950 hover:bg-violet-500/14 hover:shadow-sm hover:shadow-violet-600/10 focus-visible:ring-violet-500/45 dark:border-violet-400/40 dark:bg-violet-500/12 dark:text-violet-50 dark:hover:bg-violet-500/16 dark:hover:shadow-violet-400/14",
};

export function supportBoardChipButtonClass(action: SupportBoardAction): string {
  return cn(
    "rounded-full border px-2.5 py-2 text-left text-[11px] font-semibold sm:px-3 sm:py-1.5 sm:text-xs",
    "transform-gpu transition-[color,background-color,border-color,box-shadow,transform] duration-[160ms] ease-out",
    "motion-reduce:transition-none motion-reduce:transform-none",
    "min-h-11 touch-manipulation active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-9",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
    "motion-reduce:hover:shadow-none",
    "disabled:pointer-events-none disabled:opacity-50",
    chipToneByAction[action],
  );
}

export const supportBoardActionLabels: Record<SupportBoardAction, string> = {
  positive: "Positive",
  concern: "Concern",
  strategy: "Strategy",
  parent: "Parent contact",
};

export const supportBoardActionToCategory: Record<SupportBoardAction, SupportMomentCategory> = {
  positive: "positive_recognition",
  concern: "quick_concern",
  strategy: "support_strategy",
  parent: "parent_communication",
};

export {
  getSuggestions,
  suggestedConcern,
  suggestedParentContact,
  suggestedPositive,
  suggestedStrategy,
  supportBoardChipsByAction,
  supportBoardSuggestionsByAction,
} from "./support-board-suggestions";
export type { SupportBoardSuggestionContext, SupportBoardSuggestionsConfig } from "./support-board-suggestions";
