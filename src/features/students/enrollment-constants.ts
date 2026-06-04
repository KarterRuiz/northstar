/**
 * Shared enrollment status literals for forms and server actions.
 * Keep this module free of `"use server"` so client components can import it.
 */
export const ENROLLMENT_STATUSES = [
  "active",
  "withdrawn",
  "graduated",
  "inactive",
] as const;

export type EnrollmentStatusForm = (typeof ENROLLMENT_STATUSES)[number];
