"use server";

import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit";
import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";
import { upsertStaffMemberClassAssignment } from "@/features/classes/class-staff-assignments";
import { isUuid } from "@/lib/students/uuid";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StaffTeacherClassActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

export async function assignStaffTeacherToClassAction(
  _prev: StaffTeacherClassActionState | undefined,
  formData: FormData,
): Promise<StaffTeacherClassActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You do not have permission to assign classes." };
  }

  const teacherIdRaw = formData.get("teacherProfileId");
  const classIdRaw = formData.get("classId");
  if (typeof teacherIdRaw !== "string" || typeof classIdRaw !== "string") {
    return { ok: false, message: "Missing teacher or class." };
  }
  const teacherProfileId = teacherIdRaw.trim();
  const classId = classIdRaw.trim();
  if (!isUuid(teacherProfileId) || !isUuid(classId)) {
    return { ok: false, message: "Invalid teacher or class id." };
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", teacherProfileId)
    .maybeSingle();
  if (pErr) return { ok: false, message: pErr.message };
  if (!profile || profile.role !== "teacher") {
    return { ok: false, message: "Class assignments apply only to teacher accounts." };
  }

  const { data: member, error: memberErr } = await supabase
    .from("staff_members")
    .select("id, profile_id, status, archived_at")
    .eq("profile_id", teacherProfileId)
    .is("archived_at", null)
    .maybeSingle();
  if (memberErr) return { ok: false, message: memberErr.message };
  if (!member?.id) {
    return {
      ok: false,
      message:
        "No staff directory row is linked to this teacher. Open Teachers & Staff to repair the roster.",
    };
  }
  if (member.status === "archived" || member.status === "disabled" || member.archived_at) {
    return { ok: false, message: "Archived or deactivated staff cannot be assigned to classes." };
  }

  const upserted = await upsertStaffMemberClassAssignment(
    supabase,
    member.id,
    classId,
    "co_teacher",
    teacherProfileId,
  );
  if (!upserted.ok) {
    return { ok: false, message: upserted.error };
  }

  await recordAuditEvent({
    action: "teacher_assigned",
    actorUserId: actor.userId,
    metadata: {
      classId,
      teacherProfileId,
      staffMemberId: member.id,
      assignmentRole: "co_teacher",
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  revalidatePath(`/dashboard/${actor.role}/classes`);
  return { ok: true, message: "Teacher added to the class." };
}

export async function removeStaffTeacherFromClassAction(
  _prev: StaffTeacherClassActionState | undefined,
  formData: FormData,
): Promise<StaffTeacherClassActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You do not have permission to change class assignments." };
  }

  const assignmentIdRaw = formData.get("assignmentId");
  if (typeof assignmentIdRaw !== "string" || !isUuid(assignmentIdRaw.trim())) {
    return { ok: false, message: "Invalid assignment." };
  }
  const assignmentId = assignmentIdRaw.trim();

  const { data: row, error: readErr } = await supabase
    .from("class_teachers")
    .select("id, class_id, teacher_profile_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!row) return { ok: false, message: "Assignment not found." };

  const { data: member } = await supabase
    .from("staff_members")
    .select("id")
    .eq("profile_id", row.teacher_profile_id)
    .is("archived_at", null)
    .maybeSingle();

  const { error: delErr } = await supabase.from("class_teachers").delete().eq("id", assignmentId);
  if (delErr) return { ok: false, message: delErr.message };

  if (member?.id) {
    await supabase
      .from("staff_member_classes")
      .delete()
      .eq("staff_member_id", member.id)
      .eq("class_id", row.class_id);
  }

  await recordAuditEvent({
    action: "teacher_assigned",
    actorUserId: actor.userId,
    metadata: {
      classId: row.class_id,
      teacherProfileId: row.teacher_profile_id,
      assignmentRole: "removed_from_class",
      ...(member?.id ? { staffMemberId: member.id } : {}),
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  revalidatePath(`/dashboard/${actor.role}/classes`);
  return { ok: true, message: "Removed from class." };
}
