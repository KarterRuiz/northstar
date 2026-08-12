/**
 * School Calendar is a leadership planning workspace — not a personal calendar,
 * Google Calendar clone, or Follow-Up queue.
 *
 * Calendar = “What is happening, and when?”
 * Follow-Up = “What do I need to come back to?”
 *
 * An event is never auto-created as a follow-up. A leadership note is never
 * an event. Report-card cycles are not hard-wired here; a future “Term 1
 * Reporting Opens” event can use category `reporting` when leadership adds it.
 *
 * Timezone: Asia/Shanghai. All-day events are stored as Shanghai midnight
 * through Shanghai end-of-day so UTC midnight never shifts the school date.
 *
 * Recurrence and grade/program targeting are deferred.
 */
export const CALENDAR_ARCHITECTURE_NOTES = [
  "Events live in public.school_events. Leadership notes live in public.calendar_notes.",
  "Home shows upcoming events only — never private leadership notes.",
  "Audience leadership is invisible to teachers. all_staff / whole_school are future-safe staff reads.",
  "Teachers have a read-only Calendar workspace. RLS already hides leadership events and every calendar note.",
  "Registrar is excluded from the workspace; notes can mention staff.",
  "No sidebar Calendar tab — Home card is the teacher and leadership entry.",
  "Do not auto-create follow_ups from events.",
] as const;
