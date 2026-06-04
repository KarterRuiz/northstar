import "server-only";

import { cache } from "react";

import { BEHAVIOR_CONCERN_TYPES } from "@/features/behavior/schema";
import {
  behaviorSeverities,
  behaviorTypes,
  type BehaviorSeverity,
  type BehaviorType,
  type SupportMomentCategory,
} from "@/features/behavior/schema";
import { loadStudentIntelligence } from "@/features/students/profile/load-student-intelligence";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Role } from "@/config/roles";

export type StudentBehaviorRecord = {
  id: string;
  behaviorDate: string;
  behaviorType: BehaviorType;
  supportCategory: SupportMomentCategory | null;
  severity: BehaviorSeverity;
  title: string;
  description: string;
  generatedSummary: string | null;
  teacherNote: string | null;
  quickReason: string | null;
  followUpRequired: boolean;
  actionTaken: string | null;
  supportTags: string[];
};

export type StudentBehaviorProfile =
  | {
      ok: true;
      concernCount: number;
      positiveCount: number;
      /** Up to 12 rows for the profile timeline (newest first). */
      recent: StudentBehaviorRecord[];
      /** Up to 50 rows within the last six months — deterministic growth-story aggregation. */
      growthStoryRecords: StudentBehaviorRecord[];
      positives: StudentBehaviorRecord[];
      concerns: StudentBehaviorRecord[];
    }
  | { ok: false; message: string };

function parseSupportCategory(value: string | null | undefined): SupportMomentCategory | null {
  if (!value) return null;
  const allowed: SupportMomentCategory[] = [
    "positive_recognition",
    "quick_concern",
    "parent_communication",
    "sel_observation",
    "support_strategy",
    "intervention_followup",
  ];
  return allowed.includes(value as SupportMomentCategory) ? (value as SupportMomentCategory) : null;
}

export const loadStudentBehaviorProfile = cache(async function loadStudentBehaviorProfile(
  studentId: string,
  role: Role,
): Promise<StudentBehaviorProfile> {
  const intel = await loadStudentIntelligence(studentId, { viewerRole: role });
  if (intel.kind !== "ok") {
    return { ok: false, message: "No active enrollment for student support." };
  }

  const { classId, schoolYearLabel } = intel.data;

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      concernCount: 0,
      positiveCount: 0,
      recent: [],
      growthStoryRecords: [],
      positives: [],
      concerns: [],
    };
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);
  const behaviorDateMin = sixMonthsAgo.toISOString().slice(0, 10);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("behavior_records")
    .select(
      "id, behavior_date, behavior_type, support_category, severity, title, description, generated_summary, teacher_note, quick_reason, follow_up_required, action_taken, support_tags",
    )
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("school_year", schoolYearLabel)
    .gte("behavior_date", behaviorDateMin)
    .order("behavior_date", { ascending: false })
    .limit(50);

  if (error) return { ok: false, message: error.message };

  const recent: StudentBehaviorRecord[] = (data ?? []).map((r) => ({
    id: r.id,
    behaviorDate: r.behavior_date,
    behaviorType: behaviorTypes.includes(r.behavior_type as BehaviorType)
      ? (r.behavior_type as BehaviorType)
      : "classroom_concern",
    supportCategory: parseSupportCategory(r.support_category),
    severity: behaviorSeverities.includes(r.severity as BehaviorSeverity)
      ? (r.severity as BehaviorSeverity)
      : "low",
    title: r.title,
    description: r.description ?? "",
    generatedSummary: r.generated_summary,
    teacherNote: r.teacher_note,
    quickReason: r.quick_reason,
    followUpRequired: Boolean(r.follow_up_required),
    actionTaken: r.action_taken,
    supportTags: Array.isArray(r.support_tags) ? r.support_tags : [],
  }));

  const positives = recent.filter((r) => r.behaviorType === "positive_recognition");
  const concerns = recent.filter(
    (r) =>
      BEHAVIOR_CONCERN_TYPES.includes(r.behaviorType) &&
      (r.severity === "medium" || r.severity === "high"),
  );

  return {
    ok: true,
    concernCount: concerns.length,
    positiveCount: positives.length,
    growthStoryRecords: recent,
    recent: recent.slice(0, 12),
    positives: positives.slice(0, 5),
    concerns: concerns.slice(0, 5),
  };
});
