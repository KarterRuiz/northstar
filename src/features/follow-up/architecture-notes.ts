/**
 * Follow-Up is a calm leadership workbench — not a task manager, HR system,
 * or replacement for student records / transition notes.
 *
 * Ownership: created_by_profile_id only. Assignment to other leadership users
 * is future work and must never include teachers.
 *
 * Derived signals (attendance, invites, parent requests, report cards,
 * submitted transition notes) are computed at read time. They are not stored
 * as follow_ups rows and cannot be marked completed while the underlying
 * exception still exists.
 *
 * Waiting means leadership already acted and is waiting on someone else.
 * Pending staff invites are Waiting — not My Day. Counts and list filters
 * share bucketForItem so they cannot drift.
 *
 * Transition note bodies are never copied into follow-up rows.
 */
export const FOLLOW_UP_ARCHITECTURE_NOTES = [
  "Manual reminders live in public.follow_ups. Derived exceptions do not.",
  "Leadership-only RLS via is_school_leadership(). Teachers cannot read staff notes.",
  "Assignment / shared ownership is deferred. Creator is the owner.",
  "Staff invite “pending too long” needs a school setting before it can surface.",
] as const;
