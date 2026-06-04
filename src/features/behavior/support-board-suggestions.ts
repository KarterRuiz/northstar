/**
 * Smart suggested quick-reason chips for the Support Board overlay.
 *
 * TODO (future): Replace or merge `suggestedKeys` with server-driven picks,
 * on-device personalization, or class/student context from `getSuggestions`.
 * Keep stable `key` values — they persist to `quick_reason` and analytics.
 */

import type { SupportBoardAction, SupportBoardChip } from "./support-board-chips";

/** Curated board subset per action (order = full list in overlay when expanded). */
export type SupportBoardSuggestionsConfig = {
  all: readonly SupportBoardChip[];
  /**
   * Up to three keys promoted as the compact “recommended” row.
   * Each key must appear in `all`. Order = left-to-right in the collapsed row.
   */
  suggestedKeys: readonly string[];
};

/**
 * Static config keyed like the legacy exports (`suggestedPositive`, …) for grep-ability.
 * `all` is the single source of truth for labels + keys on the board.
 */
export const suggestedPositive: SupportBoardSuggestionsConfig = {
  suggestedKeys: ["leadership", "kindness", "participation"],
  all: [
    { key: "leadership", label: "Leadership" },
    { key: "kindness", label: "Kindness" },
    { key: "participation", label: "Participation" },
    { key: "academic_growth", label: "Academic growth" },
    { key: "collaboration", label: "Collaboration" },
    { key: "responsibility", label: "Responsibility" },
  ],
};

export const suggestedConcern: SupportBoardSuggestionsConfig = {
  suggestedKeys: ["off_task", "incomplete_work", "peer_conflict"],
  all: [
    { key: "off_task", label: "Off task" },
    { key: "incomplete_work", label: "Incomplete work" },
    { key: "peer_conflict", label: "Peer conflict" },
    { key: "emotional_regulation", label: "Emotional regulation" },
    { key: "transition_difficulty", label: "Transition difficulty" },
    { key: "disruptive_instruction", label: "Disruptive during instruction" },
  ],
};

export const suggestedStrategy: SupportBoardSuggestionsConfig = {
  suggestedKeys: ["visual_reminder", "task_chunking", "seating_adjustment"],
  all: [
    { key: "visual_reminder", label: "Visual reminder" },
    { key: "task_chunking", label: "Task chunking" },
    { key: "seating_adjustment", label: "Seating adjustment" },
    { key: "movement_break", label: "Movement break" },
    { key: "positive_reinforcement", label: "Positive reinforcement" },
    { key: "teacher_check_in", label: "Teacher check-in" },
  ],
};

export const suggestedParentContact: SupportBoardSuggestionsConfig = {
  suggestedKeys: ["positive_update", "academic_concern", "support_check_in"],
  all: [
    { key: "positive_update", label: "Positive update" },
    { key: "academic_concern", label: "Academic concern" },
    { key: "support_check_in", label: "Support check-in" },
    { key: "follow_up_discussion", label: "Follow-up discussion" },
  ],
};

export const supportBoardSuggestionsByAction: Record<SupportBoardAction, SupportBoardSuggestionsConfig> =
  {
    positive: suggestedPositive,
    concern: suggestedConcern,
    strategy: suggestedStrategy,
    parent: suggestedParentContact,
  };

/** Full chip lists for the board — same ordering as each category’s `all`. */
export const supportBoardChipsByAction: Record<SupportBoardAction, SupportBoardChip[]> = {
  positive: [...suggestedPositive.all],
  concern: [...suggestedConcern.all],
  strategy: [...suggestedStrategy.all],
  parent: [...suggestedParentContact.all],
};

/** Optional context for future AI / personalization (stub). */
export type SupportBoardSuggestionContext = {
  classId?: string;
  studentId?: string;
  /** TODO: pass roster signals, recent moments, attendance flags, etc. */
};

/**
 * Returns ordered chips for the collapsed row (`suggested`) and the full list (`all`).
 * Pure function — safe for memoization. `_context` reserved for future ranking.
 */
export function getSuggestions(
  action: SupportBoardAction,
  context?: SupportBoardSuggestionContext,
): { suggested: SupportBoardChip[]; all: SupportBoardChip[] } {
  void context; // Reserved for future ranking / AI merge; keep signature stable for call sites.

  const { all, suggestedKeys } = supportBoardSuggestionsByAction[action];
  const byKey = new Map(all.map((c) => [c.key, c] as const));
  const suggested: SupportBoardChip[] = [];
  for (const key of suggestedKeys) {
    const row = byKey.get(key);
    if (row) suggested.push(row);
    if (suggested.length >= 3) break;
  }
  return { suggested, all: [...all] };
}
