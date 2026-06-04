"use server";

import { revalidatePath } from "next/cache";

import { isRole } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";
import { isStudentId } from "@/lib/students/uuid";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type UpdateUserRoleState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

export type ToggleProfileActiveState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

async function countAdmins(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) return 0;
  return count ?? 0;
}

export async function updateUserRoleAction(
  _prev: UpdateUserRoleState | undefined,
  formData: FormData,
): Promise<UpdateUserRoleState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return {
      ok: false,
      message: "You must be signed in with permission to manage staff.",
    };
  }

  const profileIdRaw = formData.get("profileId");
  const newRoleRaw = formData.get("newRole");
  if (typeof profileIdRaw !== "string" || typeof newRoleRaw !== "string") {
    return { ok: false, message: "Missing profile or role." };
  }

  const profileId = profileIdRaw.trim();
  const newRole = newRoleRaw.trim();
  if (!isStudentId(profileId)) {
    return { ok: false, message: "Invalid profile id." };
  }
  if (!isRole(newRole)) {
    return { ok: false, message: "That role is not allowed." };
  }

  const { data: target, error: readError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();

  if (readError) {
    return { ok: false, message: readError.message };
  }
  if (!target?.role || !isRole(target.role)) {
    return { ok: false, message: "Profile not found or role is invalid." };
  }

  const oldRole = target.role;
  if (oldRole === newRole) {
    return { ok: true, message: "No change." };
  }

  if (oldRole === "admin" && newRole !== "admin") {
    const admins = await countAdmins();
    if (admins <= 1) {
      return {
        ok: false,
        message: "Cannot change the last remaining admin to a non-admin role.",
      };
    }
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", profileId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  await recordAuditEvent({
    action: "role_updated",
    actorUserId: actor.userId,
    metadata: {
      targetUserId: profileId,
      oldRole,
      newRole,
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  return { ok: true, message: "Role updated." };
}

export async function toggleProfileActiveAction(
  _prev: ToggleProfileActiveState | undefined,
  formData: FormData,
): Promise<ToggleProfileActiveState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return {
      ok: false,
      message: "You must be signed in with permission to manage staff.",
    };
  }

  const profileIdRaw = formData.get("profileId");
  const nextRaw = formData.get("nextActive");
  if (typeof profileIdRaw !== "string" || typeof nextRaw !== "string") {
    return { ok: false, message: "Missing profile or status." };
  }

  const profileId = profileIdRaw.trim();
  if (!isStudentId(profileId)) {
    return { ok: false, message: "Invalid profile id." };
  }

  const nextActive = nextRaw === "true" || nextRaw === "1";

  if (profileId === actor.userId && !nextActive) {
    return {
      ok: false,
      message: "You cannot deactivate your own account from the directory.",
    };
  }

  const { data: target, error: readError } = await supabase
    .from("profiles")
    .select("id, is_active")
    .eq("id", profileId)
    .maybeSingle();

  if (readError) {
    return { ok: false, message: readError.message };
  }
  if (!target) {
    return { ok: false, message: "Profile not found." };
  }

  if (target.is_active === nextActive) {
    return { ok: true, message: "No change." };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ is_active: nextActive })
    .eq("id", profileId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  await recordAuditEvent({
    action: "profile_status_changed",
    actorUserId: actor.userId,
    metadata: {
      targetUserId: profileId,
      oldActive: target.is_active,
      newActive: nextActive,
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  return {
    ok: true,
    message: nextActive ? "Access reactivated." : "Access deactivated.",
  };
}
