/**
 * Curated leadership vocabulary for Admin Home.
 * Static rotation — no external APIs, no per-render randomness.
 */
export type AdminWordOfTheDay = {
  word: string;
  definition: string;
};

export const ADMIN_WORDS_OF_THE_DAY = [
  {
    word: "Stewardship",
    definition:
      "The careful and responsible management of something entrusted to you.",
  },
  {
    word: "Clarity",
    definition: "Making the work easy to understand and free of confusion.",
  },
  {
    word: "Consistency",
    definition: "Holding the same standard from one day to the next.",
  },
  {
    word: "Discernment",
    definition: "Judging well enough to see what matters most.",
  },
  {
    word: "Initiative",
    definition: "Acting on what needs doing without waiting to be asked.",
  },
  {
    word: "Presence",
    definition:
      "Giving full attention to the people and work in front of you.",
  },
  {
    word: "Resolve",
    definition: "Firm determination to carry a decision through.",
  },
  {
    word: "Trust",
    definition: "Confidence in someone's character and reliability.",
  },
  {
    word: "Purpose",
    definition: "A clear reason that guides what you choose to do.",
  },
  {
    word: "Composure",
    definition: "Calm self-possession when the day is under pressure.",
  },
  {
    word: "Integrity",
    definition: "Keeping what you say aligned with what you do.",
  },
  {
    word: "Patience",
    definition: "Waiting and working without forcing an outcome.",
  },
  {
    word: "Alignment",
    definition: "People, priorities, and action pointed at the same aim.",
  },
  {
    word: "Responsibility",
    definition: "Owning the outcomes that fall within your care.",
  },
  {
    word: "Perspective",
    definition: "Keeping a single moment in proportion to the whole.",
  },
  {
    word: "Intentionality",
    definition: "Choosing deliberately how time and attention are spent.",
  },
  {
    word: "Service",
    definition: "Doing the work for the good of others, not for display.",
  },
  {
    word: "Judgment",
    definition: "Deciding soundly when the answer is not obvious.",
  },
  {
    word: "Focus",
    definition: "Keeping attention on what most needs it now.",
  },
  {
    word: "Momentum",
    definition: "Forward movement built by finishing the next right thing.",
  },
] as const satisfies readonly AdminWordOfTheDay[];

/** Local calendar day-of-year, matching the daily-note rotation. */
function dayOfYear(now: Date): number {
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

/** Stable pick from the curated list — same word for every leadership user that date. */
export function getAdminWordOfTheDay(now = new Date()): AdminWordOfTheDay {
  const index = dayOfYear(now) % ADMIN_WORDS_OF_THE_DAY.length;
  return ADMIN_WORDS_OF_THE_DAY[index]!;
}
