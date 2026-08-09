"use server";

import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit";
import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";
import { isUuid } from "@/lib/students/uuid";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StaffTeacherGradeActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

function parseGradeLevelIds(formData: FormData): string[] {
  const raw = formData.getAll("gradeLevelIds");
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (isUuid(id)) out.push(id);
  }
  return [...new Set(out)];
}

/** Replace a teacher's grade-level access with the submitted set. */
export async function replaceStaffTeacherGradeAccessAction(
  _prev: StaffTeacherGradeActionState | undefined,
  formData: FormData,
): Promise<StaffTeacherGradeActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You do not have permission to manage grade access." };
  }

  const teacherIdRaw = formData.get("teacherProfileId");
  if (typeof teacherIdRaw !== "string" || !isUuid(teacherIdRaw.trim())) {
    return { ok: false, message: "Invalid teacher." };
  }
  const teacherProfileId = teacherIdRaw.trim();
  const gradeLevelIds = parseGradeLevelIds(formData);

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", teacherProfileId)
    .maybeSingle();
  if (pErr) return { ok: false, message: "Could not load that staff profile." };
  if (!profile || profile.role !== "teacher") {
    return { ok: false, message: "Grade access applies only to teacher accounts." };
  }

  const { error: delErr } = await supabase
    .from("staff_grade_levels")
    .delete()
    .eq("profile_id", teacherProfileId);
  if (delErr) {
    return { ok: false, message: "Could not update grade access. Try again." };
  }

  if (gradeLevelIds.length > 0) {
    const { error: insErr } = await supabase.from("staff_grade_levels").insert(
      gradeLevelIds.map((grade_level_id) => ({
        profile_id: teacherProfileId,
        grade_level_id,
      })),
    );
    if (insErr) {
      return { ok: false, message: "Could not save grade access. Try again." };
    }
  }

  await recordAuditEvent({
    action: "staff_grade_access_updated",
    actorUserId: actor.userId,
    metadata: {
      teacherProfileId,
      gradeLevelIds,
      op: "replace",
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  return { ok: true, message: "Grade access updated." };
}
