import type { SupportMomentCategory } from "@/lib/student-support/quick-reasons";

/** All values stored in `behavior_records.behavior_type`. */
export const behaviorTypes = [
  "positive_recognition",
  "classroom_concern",
  "behavior_incident",
  "participation",
  "social_emotional",
  "parent_contact",
  "intervention_followup",
] as const;

export type BehaviorType = (typeof behaviorTypes)[number];

/** Re-export for filters and forms. */
export { supportMomentCategories, type SupportMomentCategory } from "@/lib/student-support/quick-reasons";
export { supportMomentCategoryLabels } from "@/lib/student-support/quick-reasons";

/** Maps guided UI category → persisted `behavior_type`. */
export function supportCategoryToBehaviorType(category: SupportMomentCategory): BehaviorType {
  const m: Record<SupportMomentCategory, BehaviorType> = {
    positive_recognition: "positive_recognition",
    quick_concern: "classroom_concern",
    parent_communication: "parent_contact",
    sel_observation: "social_emotional",
    support_strategy: "participation",
    intervention_followup: "intervention_followup",
  };
  return m[category];
}

/** Reverse map for rows that only have `behavior_type` (legacy rows). */
export function behaviorTypeToSupportCategory(type: BehaviorType): SupportMomentCategory | null {
  const m: Partial<Record<BehaviorType, SupportMomentCategory>> = {
    positive_recognition: "positive_recognition",
    classroom_concern: "quick_concern",
    behavior_incident: "quick_concern",
    parent_contact: "parent_communication",
    social_emotional: "sel_observation",
    participation: "support_strategy",
    intervention_followup: "intervention_followup",
  };
  return m[type] ?? null;
}

export const behaviorSeverities = ["positive", "low", "medium", "high"] as const;

export type BehaviorSeverity = (typeof behaviorSeverities)[number];

/** Timeline / filter labels — Student Support framing. */
export const behaviorTypeLabels: Record<BehaviorType, string> = {
  positive_recognition: "Positive recognition",
  classroom_concern: "Quick concern",
  behavior_incident: "Quick concern",
  participation: "Support strategy",
  social_emotional: "SEL observation",
  parent_contact: "Parent communication",
  intervention_followup: "Intervention follow-up",
};

/** Filter dropdown: one entry per distinct teacher-facing type. */
export const behaviorFilterTypes: BehaviorType[] = [
  "positive_recognition",
  "classroom_concern",
  "parent_contact",
  "social_emotional",
  "participation",
  "intervention_followup",
];

export const behaviorFilterLabels: Record<BehaviorType, string> = {
  ...behaviorTypeLabels,
};

/** UI label for severity — framed as support level, not discipline. */
export const supportLevelLabels: Record<BehaviorSeverity, string> = {
  positive: "Strength moment",
  low: "Light touch",
  medium: "Follow-up soon",
  high: "Priority support",
};

/** @deprecated Use `supportLevelLabels` in UI. */
export const behaviorSeverityLabels = supportLevelLabels;

/** Types that count toward behavior-concern rule flags. */
export const BEHAVIOR_CONCERN_TYPES: BehaviorType[] = [
  "classroom_concern",
  "behavior_incident",
];

export function defaultSupportLevelForCategory(
  category: SupportMomentCategory,
): BehaviorSeverity {
  if (category === "positive_recognition") return "positive";
  if (category === "parent_communication") return "medium";
  if (category === "intervention_followup") return "medium";
  return "low";
}

export type BehaviorStudentOption = {
  id: string;
  label: string;
  classIds: string[];
};

export type CreateBehaviorRecordInput = {
  studentId: string;
  classId: string;
  behaviorDate: string;
  supportCategory: SupportMomentCategory;
  severity: BehaviorSeverity;
  /** Populated for search compatibility; mirrors `generated_summary` truncated. */
  title: string;
  /** Legacy column; optional mirror of teacher note for older readers. */
  description?: string;
  actionTaken?: string | null;
  quickReason: string;
  supportTags: string[];
  generatedSummary: string;
  teacherNote?: string | null;
  followUpRequired: boolean;
  parentContacted: boolean | null;
  timeOfDay: string | null;
  relatedSubject: string | null;
};
