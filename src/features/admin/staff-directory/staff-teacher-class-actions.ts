"use server";

import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit";
import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";
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

  const { data: existing, error: exErr } = await supabase
    .from("class_teachers")
    .select("id")
    .eq("class_id", classId)
    .eq("teacher_profile_id", teacherProfileId)
    .maybeSingle();
  if (exErr) return { ok: false, message: exErr.message };
  if (existing?.id) {
    return { ok: true, message: "Already assigned to that class." };
  }

  const { error } = await supabase.from("class_teachers").insert({
    class_id: classId,
    teacher_profile_id: teacherProfileId,
    role: "co_teacher",
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await recordAuditEvent({
    action: "teacher_assigned",
    actorUserId: actor.userId,
    metadata: {
      classId,
      teacherProfileId,
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

  const { error: delErr } = await supabase.from("class_teachers").delete().eq("id", assignmentId);
  if (delErr) return { ok: false, message: delErr.message };

  await recordAuditEvent({
    action: "teacher_assigned",
    actorUserId: actor.userId,
    metadata: {
      classId: row.class_id,
      teacherProfileId: row.teacher_profile_id,
      assignmentRole: "removed_from_class",
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  revalidatePath(`/dashboard/${actor.role}/classes`);
  return { ok: true, message: "Removed from class." };
}
