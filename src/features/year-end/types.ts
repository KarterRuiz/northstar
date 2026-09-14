/** Year-end Phase 1 domain types (preview / draft planning only). */

export const YEAR_END_PLAN_STATUSES = ["draft", "ready", "finalized"] as const;
export type YearEndPlanStatus = (typeof YEAR_END_PLAN_STATUSES)[number];

/** User-facing dispositions (Phase 1). */
export const YEAR_END_DISPOSITIONS = [
  "promote",
  "retain",
  "remap",
  "graduate_primary",
  "leave_school",
  "custom",
] as const;
export type YearEndDisposition = (typeof YEAR_END_DISPOSITIONS)[number];

export const YEAR_END_DISPOSITION_LABELS: Record<YearEndDisposition, string> = {
  promote: "Promote",
  retain: "Retain",
  remap: "Remap",
  graduate_primary: "Graduate Primary",
  leave_school: "Leave School",
  custom: "Custom",
};

export const YEAR_END_STEPS = [
  "setup",
  "class-map",
  "students",
  "preview",
] as const;
export type YearEndStep = (typeof YEAR_END_STEPS)[number];

export const YEAR_END_STEP_LABELS: Record<YearEndStep, string> = {
  setup: "Setup",
  "class-map": "Class Mapping",
  students: "Student Review",
  preview: "Preview",
};

export type YearEndBlockerCode =
  | "missing_destination"
  | "missing_student_number"
  | "wrong_year_destination"
  | "inactive_destination"
  | "target_year_conflict"
  | "custom_reason_required"
  | "destination_not_allowed"
  | "grade5_has_destination"
  | "missing_source_enrollment";

export type YearEndBlocker = {
  code: YearEndBlockerCode;
  studentId: string;
  itemId?: string;
  message: string;
};

export type GradeLevelRef = {
  id: string;
  name: string;
  code: string | null;
  sort_order: number;
  is_archived: boolean;
};

export type ClassRef = {
  id: string;
  school_year_id: string;
  grade_level_id: string;
  name: string;
  section: string | null;
  is_active: boolean;
};
