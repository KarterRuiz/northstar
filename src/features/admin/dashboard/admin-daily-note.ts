/**
 * Quiet, professional daily note for Admin Home.
 * Curated static rotation — no external APIs.
 */
const DAILY_NOTES = [
  "A clear view of the day makes space for good decisions.",
  "Small follow-ups today keep the week steady.",
  "Lead with clarity; the details live in each workspace.",
  "Presence and consistency matter more than urgency.",
  "Notice what’s working, then address what needs a look.",
  "Your teams move faster when priorities are visible.",
  "Steady schools are built one ordinary day at a time.",
] as const;

/** Stable pick from curated notes based on local calendar day. */
export function getAdminDailyNote(now = new Date()): string {
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return DAILY_NOTES[dayOfYear % DAILY_NOTES.length]!;
}
