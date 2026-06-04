/**
 * Quick-reason options for the guided Student Support flow.
 * Keys are stable for analytics; labels are teacher-facing.
 */

export const supportMomentCategories = [
  "positive_recognition",
  "quick_concern",
  "parent_communication",
  "sel_observation",
  "support_strategy",
  "intervention_followup",
] as const;

export type SupportMomentCategory = (typeof supportMomentCategories)[number];

export type QuickReasonOption = { key: string; label: string };

export const supportMomentCategoryLabels: Record<SupportMomentCategory, string> = {
  positive_recognition: "Positive recognition",
  quick_concern: "Quick concern",
  parent_communication: "Parent communication",
  sel_observation: "SEL observation",
  support_strategy: "Support strategy",
  intervention_followup: "Intervention follow-up",
};

/** Quick reasons per guided type (all lists from product spec). */
export const quickReasonsByCategory: Record<SupportMomentCategory, QuickReasonOption[]> = {
  positive_recognition: [
    { key: "leadership", label: "Leadership" },
    { key: "collaboration", label: "Collaboration" },
    { key: "academic_growth", label: "Academic growth" },
    { key: "kindness", label: "Kindness" },
    { key: "persistence", label: "Persistence" },
    { key: "participation", label: "Participation" },
    { key: "responsibility", label: "Responsibility" },
  ],
  quick_concern: [
    { key: "off_task", label: "Off task" },
    { key: "incomplete_work", label: "Incomplete work" },
    { key: "peer_conflict", label: "Peer conflict" },
    { key: "emotional_regulation", label: "Emotional regulation" },
    { key: "transition_difficulty", label: "Transition difficulty" },
    { key: "difficulty_transitioning", label: "Difficulty transitioning" },
    { key: "technology_misuse", label: "Technology misuse" },
    { key: "disruptive_instruction", label: "Disruptive during instruction" },
    { key: "unprepared", label: "Unprepared for class" },
  ],
  parent_communication: [
    { key: "positive_update", label: "Positive update" },
    { key: "academic_concern", label: "Academic concern" },
    { key: "support_check_in", label: "Support check-in" },
    { key: "behavioral_concern", label: "Behavioral concern" },
    { key: "follow_up_discussion", label: "Follow-up discussion" },
    { key: "academic_check_in", label: "Academic check-in" },
    { key: "attendance_concern", label: "Attendance concern" },
    { key: "social_emotional_update", label: "Social-emotional update" },
    { key: "scheduling_logistics", label: "Scheduling / logistics" },
    { key: "requested_callback", label: "Requested callback" },
    { key: "shared_resources", label: "Shared resources / strategies" },
    { key: "celebration", label: "Celebration of growth" },
  ],
  sel_observation: [
    { key: "self_regulation", label: "Self-regulation" },
    { key: "peer_interaction", label: "Peer interaction" },
    { key: "coping_strategy", label: "Coping strategy observed" },
    { key: "calm_recovery", label: "Calm recovery after stress" },
    { key: "self_advocacy", label: "Self-advocacy" },
    { key: "empathy", label: "Empathy" },
    { key: "mindfulness_focus", label: "Focus / mindfulness" },
    { key: "sensory_needs", label: "Sensory needs noted" },
  ],
  support_strategy: [
    { key: "visual_reminder", label: "Visual reminder" },
    { key: "visual_reminders", label: "Visual reminders" },
    { key: "seating_adjustment", label: "Seating adjustment" },
    { key: "task_chunking", label: "Task chunking" },
    { key: "peer_support", label: "Peer support" },
    { key: "check_in_out", label: "Check-in/check-out" },
    { key: "positive_reinforcement", label: "Positive reinforcement" },
    { key: "movement_break", label: "Movement break" },
    { key: "teacher_check_in", label: "Teacher check-in" },
    { key: "teacher_conference", label: "Teacher conference" },
  ],
  intervention_followup: [
    { key: "tier1_checkin", label: "Tier 1 check-in" },
    { key: "small_group", label: "Small group progress" },
    { key: "specialist_meeting", label: "Meeting with specialist" },
    { key: "plan_adjustment", label: "Plan adjustment" },
    { key: "home_school_coordination", label: "Home–school coordination" },
    { key: "data_review", label: "Data review" },
    { key: "goal_progress", label: "Goal progress monitoring" },
    { key: "next_step_scheduled", label: "Next step scheduled" },
  ],
};

export function quickReasonLabel(
  category: SupportMomentCategory,
  key: string,
): string {
  const list = quickReasonsByCategory[category];
  return list.find((r) => r.key === key)?.label ?? key;
}
