/**
 * Quiet classroom lines for Teacher Home.
 * Curated static rotation — no external APIs, not a poster.
 */
const DAILY_NOTES = [
  "Small routines create strong classrooms.",
  "Clear expectations make learning easier.",
  "Consistency gives students confidence.",
  "Presence matters more than a perfect plan.",
  "One calm start sets the tone for the day.",
  "Notice what is working, then adjust the rest.",
  "Steady attention helps every student settle in.",
] as const;

/** Stable pick from curated notes based on local calendar day. */
export function getTeacherDailyNote(now = new Date()): string {
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return DAILY_NOTES[dayOfYear % DAILY_NOTES.length]!;
}
