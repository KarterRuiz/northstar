"use server";

import { revalidatePath } from "next/cache";

import { isRole } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getAdminActor } from "@/lib/auth/require-admin";
import { isStudentId } from "@/lib/students/uuid";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type UpdateUserRoleState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

const STAFF_DIRECTORY_PATH = "/dashboard/admin/teachers";

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
  const actor = await getAdminActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in as an admin." };
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

  if (
    profileId === actor.userId &&
    oldRole === "admin" &&
    newRole !== "admin"
  ) {
    const admins = await countAdmins();
    if (admins <= 1) {
      return {
        ok: false,
        message:
          "You are the only admin. Add another admin before changing your own role.",
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

  revalidatePath(STAFF_DIRECTORY_PATH);
  return { ok: true, message: "Role updated." };
}
