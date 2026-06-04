/** Client-safe copy for delete guardrails and confirmation dialogs. */
export const CLASS_HAS_RECORDS_MESSAGE =
  "This class contains academic records and should be archived instead.";

export const CLASS_DELETE_CONFIRM_HINT =
  "Only empty or test classes should be permanently deleted.";

/** Matches `class_teachers.role` defaults and seed usage. */
export const CLASS_TEACHER_ROLE_HOMEROOM = "homeroom" as const;

/** Additional class teacher roles (free text in DB; keep values stable for UI). */
export const CLASS_TEACHER_EXTRA_ROLES = [
  "co_teacher",
  "subject",
  "assistant",
] as const;

export type ClassTeacherExtraRole = (typeof CLASS_TEACHER_EXTRA_ROLES)[number];
