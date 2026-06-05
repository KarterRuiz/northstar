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

/**
 * UI-only keys for additional teacher assignment. Mapped to `CLASS_TEACHER_EXTRA_ROLES` in
 * server actions — `class_teachers.role` stores only `co_teacher` | `subject` | `assistant`
 * (see foundation migration; no separate esl/counselor columns).
 */
export const CLASS_TEACHER_UI_EXTRA_ROLE_KEYS = [
  "co_teacher",
  "subject",
  "esl",
  "assistant",
  "counselor",
] as const;

export type ClassTeacherUiExtraRole = (typeof CLASS_TEACHER_UI_EXTRA_ROLE_KEYS)[number];

export const CLASS_TEACHER_UI_EXTRA_ROLE_LABELS: Record<ClassTeacherUiExtraRole, string> = {
  co_teacher: "Co Teacher",
  subject: "Subject Teacher",
  esl: "ESL Teacher",
  assistant: "Assistant Teacher",
  counselor: "Counselor",
};

/** Maps UI role pick to the `class_teachers.role` string we persist (subset of app-supported extras). */
export function uiExtraRoleToDbRole(ui: ClassTeacherUiExtraRole): ClassTeacherExtraRole {
  switch (ui) {
    case "co_teacher":
      return "co_teacher";
    case "subject":
    case "esl":
      return "subject";
    case "assistant":
    case "counselor":
      return "assistant";
    default: {
      const _exhaustive: never = ui;
      return _exhaustive;
    }
  }
}

/** Best-effort inverse for editing: DB cannot distinguish ESL vs Subject or Counselor vs Assistant. */
export function dbExtraRoleToUiRole(db: string): ClassTeacherUiExtraRole {
  if (db === "co_teacher") return "co_teacher";
  if (db === "subject") return "subject";
  if (db === "assistant") return "assistant";
  return "co_teacher";
}

export function formatClassTeacherRoleForDisplay(dbRole: string): string {
  switch (dbRole) {
    case "homeroom":
      return "Homeroom";
    case "co_teacher":
      return "Co teacher";
    case "subject":
      return "Subject teacher";
    case "assistant":
      return "Assistant teacher";
    default:
      return dbRole.replaceAll("_", " ");
  }
}
