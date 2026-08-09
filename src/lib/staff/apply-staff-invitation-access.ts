import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

const PENDING_INVITE_TEACHER_CLASS_ROLE = "co_teacher" as const;

/**
 * Applies pending grade + class access from a staff invitation onto a profile.
 * Idempotent for unique constraint conflicts (23505).
 */
export async function applyStaffInvitationAccess(
  client: SupabaseClient<Database>,
  params: {
    profileId: string;
    role: string;
    pendingClassIds: string[] | null | undefined;
    pendingGradeLevelIds: string[] | null | undefined;
  },
): Promise<{ classCount: number; gradeCount: number }> {
  let gradeCount = 0;
  let classCount = 0;

  if (params.role === "teacher" && Array.isArray(params.pendingGradeLevelIds)) {
    for (const gradeLevelId of params.pendingGradeLevelIds) {
      if (typeof gradeLevelId !== "string") continue;
      const { error } = await client.from("staff_grade_levels").insert({
        profile_id: params.profileId,
        grade_level_id: gradeLevelId,
      });
      if (!error) {
        gradeCount += 1;
      } else if (error.code !== "23505" && process.env.NODE_ENV === "development") {
        console.warn("[staff-invite] staff_grade_levels insert:", error.message);
      } else if (error.code === "23505") {
        gradeCount += 1;
      }
    }
  }

  if (params.role === "teacher" && Array.isArray(params.pendingClassIds)) {
    for (const classId of params.pendingClassIds) {
      if (typeof classId !== "string") continue;
      const { error } = await client.from("class_teachers").insert({
        class_id: classId,
        teacher_profile_id: params.profileId,
        role: PENDING_INVITE_TEACHER_CLASS_ROLE,
      });
      if (!error) {
        classCount += 1;
      } else if (error.code !== "23505" && process.env.NODE_ENV === "development") {
        console.warn("[staff-invite] class_teachers insert:", error.message);
      } else if (error.code === "23505") {
        classCount += 1;
      }
    }
  }

  return { classCount, gradeCount };
}
