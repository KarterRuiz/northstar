import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type ClassStaffRole = "homeroom" | "co_teacher" | "subject" | "assistant";

function normalizeClassStaffRole(role: string | null | undefined): ClassStaffRole {
  if (role === "homeroom" || role === "subject" || role === "assistant" || role === "co_teacher") {
    return role;
  }
  return "co_teacher";
}

/**
 * Applies pending grade + class access from a staff invitation / roster onto a profile.
 * Prefer staff_member_classes (with role) when provided; fall back to pending class ids.
 * Idempotent for unique constraint conflicts (23505).
 */
export async function applyStaffInvitationAccess(
  client: SupabaseClient<Database>,
  params: {
    profileId: string;
    role: string;
    pendingClassIds: string[] | null | undefined;
    pendingGradeLevelIds: string[] | null | undefined;
    /** Optional explicit class staffing with roles (from staff_member_classes). */
    classAssignments?: Array<{ classId: string; role?: string | null }> | null;
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

  const assignments: Array<{ classId: string; role: ClassStaffRole }> = [];
  if (Array.isArray(params.classAssignments) && params.classAssignments.length > 0) {
    for (const row of params.classAssignments) {
      if (typeof row.classId !== "string") continue;
      assignments.push({
        classId: row.classId,
        role: normalizeClassStaffRole(row.role),
      });
    }
  } else if (Array.isArray(params.pendingClassIds)) {
    for (const classId of params.pendingClassIds) {
      if (typeof classId !== "string") continue;
      assignments.push({ classId, role: "co_teacher" });
    }
  }

  // Teachers get class_teachers rows; leadership may also be assigned instructional classes.
  const mayReceiveClassAccess =
    params.role === "teacher" ||
    params.role === "principal" ||
    params.role === "vice_principal";

  if (mayReceiveClassAccess) {
    for (const row of assignments) {
      const { data: existing } = await client
        .from("class_teachers")
        .select("id, role")
        .eq("class_id", row.classId)
        .eq("teacher_profile_id", params.profileId)
        .maybeSingle();

      if (existing?.id) {
        if (existing.role !== row.role) {
          const { error } = await client
            .from("class_teachers")
            .update({ role: row.role })
            .eq("id", existing.id);
          if (!error) {
            classCount += 1;
          } else if (process.env.NODE_ENV === "development") {
            console.warn("[staff-invite] class_teachers update:", error.message);
          }
        } else {
          classCount += 1;
        }
        continue;
      }

      const { error } = await client.from("class_teachers").insert({
        class_id: row.classId,
        teacher_profile_id: params.profileId,
        role: row.role,
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
