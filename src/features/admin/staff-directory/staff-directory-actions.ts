"use server";

import { revalidatePath } from "next/cache";

import { isRole } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import {
  checkStaffDeletable,
  STAFF_HAS_RECORDS_MESSAGE,
} from "@/features/admin/staff-directory/staff-lifecycle";
import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";
import { isStudentId } from "@/lib/students/uuid";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidEmailFormat } from "@/lib/validation/is-valid-email-format";

export type UpdateUserRoleState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

export type ToggleProfileActiveState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

export type UpdateStaffProfileState =
  | {
      ok: true;
      message?: string;
      emailReconfirmationRequired?: boolean;
    }
  | { ok: false; message: string };

export type DeleteStaffProfileState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function composeFullName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(" ").trim();
}

/** Count active admins only — deactivated admins do not satisfy the last-admin safeguard. */
async function countActiveAdmins(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);
  if (error) return 0;
  return count ?? 0;
}

async function wouldLeaveNoActiveAdmin(args: {
  targetId: string;
  targetRole: string;
  targetIsActive: boolean;
  nextRole: string;
  nextActive: boolean;
}): Promise<boolean> {
  const wasActiveAdmin = args.targetRole === "admin" && args.targetIsActive;
  const willBeActiveAdmin = args.nextRole === "admin" && args.nextActive;
  if (!wasActiveAdmin || willBeActiveAdmin) return false;
  const admins = await countActiveAdmins();
  return admins <= 1;
}

/**
 * Update Auth email first, then profiles.email, so the two never diverge.
 * Uses the server-only admin client. Prefer `email_confirm: true` for admin corrections
 * so login works with the corrected address; if the project still queues reconfirmation,
 * surface that in the returned message.
 */
async function syncStaffEmailAuthAndProfile(args: {
  profileId: string;
  previousEmail: string | null;
  nextEmail: string;
}): Promise<
  | { ok: true; reconfirmationRequired: boolean; message?: string }
  | { ok: false; message: string }
> {
  let adminClient: ReturnType<typeof createAdminSupabaseClient>;
  try {
    adminClient = createAdminSupabaseClient();
  } catch {
    return {
      ok: false,
      message:
        "Email could not be updated: server admin credentials are not configured.",
    };
  }

  const { data: authBefore, error: readAuthError } =
    await adminClient.auth.admin.getUserById(args.profileId);
  if (readAuthError || !authBefore?.user) {
    return {
      ok: false,
      message: "Could not load the auth account for this staff member.",
    };
  }

  const authEmailBefore = normalizeEmail(authBefore.user.email ?? "");
  let reconfirmationRequired = false;
  let authWasUpdated = false;

  if (authEmailBefore !== args.nextEmail) {
    const { data: authUpdated, error: authUpdateError } =
      await adminClient.auth.admin.updateUserById(args.profileId, {
        email: args.nextEmail,
        email_confirm: true,
      });

    if (authUpdateError) {
      return {
        ok: false,
        message: authUpdateError.message || "Could not update the auth email.",
      };
    }

    authWasUpdated = true;
    const authEmailAfter = normalizeEmail(authUpdated.user?.email ?? "");
    const pendingNewEmail =
      typeof (authUpdated.user as { new_email?: string } | undefined)?.new_email ===
      "string"
        ? normalizeEmail((authUpdated.user as { new_email?: string }).new_email ?? "")
        : "";

    reconfirmationRequired =
      authEmailAfter !== args.nextEmail && pendingNewEmail === args.nextEmail;

    if (authEmailAfter !== args.nextEmail && !reconfirmationRequired) {
      if (authEmailBefore) {
        await adminClient.auth.admin.updateUserById(args.profileId, {
          email: authEmailBefore,
          email_confirm: true,
        });
      }
      return {
        ok: false,
        message: "Auth email did not update to the new address. Profile was not changed.",
      };
    }
  }

  const supabase = await createServerSupabaseClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ email: args.nextEmail })
    .eq("id", args.profileId);

  if (profileError) {
    if (authWasUpdated && authEmailBefore) {
      await adminClient.auth.admin.updateUserById(args.profileId, {
        email: authEmailBefore,
        email_confirm: true,
      });
    }
    return {
      ok: false,
      message: authWasUpdated
        ? "Could not update the directory email. Auth change was reverted."
        : "Could not update the directory email.",
    };
  }

  return {
    ok: true,
    reconfirmationRequired,
    message: reconfirmationRequired
      ? "Email change is pending confirmation. They must confirm the new address before it becomes their sign-in email; the directory already shows the new address."
      : undefined,
  };
}

export async function updateStaffProfileAction(
  _prev: UpdateStaffProfileState | undefined,
  formData: FormData,
): Promise<UpdateStaffProfileState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return {
      ok: false,
      message: "You must be signed in with permission to manage staff.",
    };
  }

  const profileIdRaw = formData.get("profileId");
  const firstNameRaw = formData.get("firstName");
  const lastNameRaw = formData.get("lastName");
  const emailRaw = formData.get("email");
  const newRoleRaw = formData.get("newRole");
  const nextActiveRaw = formData.get("nextActive");

  if (
    typeof profileIdRaw !== "string" ||
    typeof firstNameRaw !== "string" ||
    typeof lastNameRaw !== "string" ||
    typeof emailRaw !== "string" ||
    typeof newRoleRaw !== "string" ||
    typeof nextActiveRaw !== "string"
  ) {
    return { ok: false, message: "Missing staff fields." };
  }

  const profileId = profileIdRaw.trim();
  if (!isStudentId(profileId)) {
    return { ok: false, message: "Invalid profile id." };
  }

  const firstName = firstNameRaw.trim();
  const lastName = lastNameRaw.trim();
  const fullName = composeFullName(firstName, lastName);
  const email = normalizeEmail(emailRaw);
  const newRole = newRoleRaw.trim();
  const nextActive = nextActiveRaw === "true" || nextActiveRaw === "1";

  if (!firstName || !lastName) {
    return { ok: false, message: "First and last name are required." };
  }
  if (!fullName) {
    return { ok: false, message: "Name is required." };
  }
  if (!email || !isValidEmailFormat(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!isRole(newRole)) {
    return { ok: false, message: "That role is not allowed." };
  }

  const { data: target, error: readError } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, is_active")
    .eq("id", profileId)
    .maybeSingle();

  if (readError) {
    return { ok: false, message: readError.message };
  }
  if (!target?.role || !isRole(target.role)) {
    return { ok: false, message: "Profile not found or role is invalid." };
  }

  if (profileId === actor.userId && !nextActive) {
    return {
      ok: false,
      message: "You cannot deactivate your own account from the directory.",
    };
  }

  if (
    await wouldLeaveNoActiveAdmin({
      targetId: profileId,
      targetRole: target.role,
      targetIsActive: target.is_active,
      nextRole: newRole,
      nextActive,
    })
  ) {
    return {
      ok: false,
      message:
        "Cannot remove the last remaining active admin. Promote or reactivate another admin first.",
    };
  }

  const previousEmail = target.email ? normalizeEmail(target.email) : null;
  const nameChanged = (target.full_name?.trim() ?? "") !== fullName;
  const emailChanged = previousEmail !== email;
  const roleChanged = target.role !== newRole;
  const statusChanged = target.is_active !== nextActive;

  if (!nameChanged && !emailChanged && !roleChanged && !statusChanged) {
    return { ok: true, message: "No change." };
  }

  let emailReconfirmationRequired = false;
  let emailMessage: string | undefined;

  if (emailChanged) {
    const emailSync = await syncStaffEmailAuthAndProfile({
      profileId,
      previousEmail,
      nextEmail: email,
    });
    if (!emailSync.ok) {
      return emailSync;
    }
    emailReconfirmationRequired = emailSync.reconfirmationRequired;
    emailMessage = emailSync.message;
  }

  const profilePatch: {
    full_name?: string;
    role?: string;
    is_active?: boolean;
    email?: string;
  } = {};
  if (nameChanged) profilePatch.full_name = fullName;
  if (roleChanged) profilePatch.role = newRole;
  if (statusChanged) profilePatch.is_active = nextActive;
  // Email already written inside syncStaffEmailAuthAndProfile when changed.

  if (Object.keys(profilePatch).length > 0) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update(profilePatch)
      .eq("id", profileId);

    if (updateError) {
      return { ok: false, message: updateError.message };
    }
  }

  const changedParts: string[] = [];
  if (nameChanged) changedParts.push("name");
  if (emailChanged) changedParts.push("email");
  if (roleChanged) changedParts.push("role");
  if (statusChanged) changedParts.push("access");

  if (nameChanged || emailChanged) {
    await recordAuditEvent({
      action: "staff_profile_updated",
      actorUserId: actor.userId,
      metadata: {
        targetUserId: profileId,
        changedSummary: changedParts.join(", "),
        emailChanged,
        emailReconfirmationRequired,
      },
    });
  }

  if (roleChanged) {
    await recordAuditEvent({
      action: "role_updated",
      actorUserId: actor.userId,
      metadata: {
        targetUserId: profileId,
        oldRole: target.role,
        newRole,
      },
    });
  }

  if (statusChanged) {
    await recordAuditEvent({
      action: "profile_status_changed",
      actorUserId: actor.userId,
      metadata: {
        targetUserId: profileId,
        oldActive: target.is_active,
        newActive: nextActive,
      },
    });
  }

  revalidatePath(staffDirectoryPath(actor.role));

  const baseMessage = `Staff updated (${changedParts.join(", ")}).`;
  return {
    ok: true,
    message: emailMessage ? `${baseMessage} ${emailMessage}` : baseMessage,
    emailReconfirmationRequired,
  };
}

/** @deprecated Prefer updateStaffProfileAction; kept for role-only callers. */
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
    .select("id, role, is_active")
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
    await wouldLeaveNoActiveAdmin({
      targetId: profileId,
      targetRole: oldRole,
      targetIsActive: target.is_active,
      nextRole: newRole,
      nextActive: target.is_active,
    })
  ) {
    return {
      ok: false,
      message: "Cannot change the last remaining active admin to a non-admin role.",
    };
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
    .select("id, role, is_active")
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

  if (
    await wouldLeaveNoActiveAdmin({
      targetId: profileId,
      targetRole: target.role,
      targetIsActive: target.is_active,
      nextRole: target.role,
      nextActive,
    })
  ) {
    return {
      ok: false,
      message:
        "Cannot deactivate the last remaining active admin. Promote another admin first.",
    };
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

export async function deleteStaffProfileAction(
  _prev: DeleteStaffProfileState | undefined,
  formData: FormData,
): Promise<DeleteStaffProfileState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return {
      ok: false,
      message: "You must be signed in with permission to manage staff.",
    };
  }

  const profileIdRaw = formData.get("profileId");
  if (typeof profileIdRaw !== "string") {
    return { ok: false, message: "Missing profile." };
  }
  const profileId = profileIdRaw.trim();
  if (!isStudentId(profileId)) {
    return { ok: false, message: "Invalid profile id." };
  }

  if (profileId === actor.userId) {
    return { ok: false, message: "You cannot permanently delete your own account." };
  }

  const { data: target, error: readError } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, is_active")
    .eq("id", profileId)
    .maybeSingle();

  if (readError) {
    return { ok: false, message: readError.message };
  }
  if (!target) {
    return { ok: false, message: "Profile not found." };
  }

  if (target.is_active) {
    return {
      ok: false,
      message: "Deactivate the staff member before permanently deleting.",
    };
  }

  const activeAdmins = await countActiveAdmins();
  if (target.role === "admin" && activeAdmins === 0) {
    return {
      ok: false,
      message:
        "Cannot permanently delete the only admin account. Create another active admin first.",
    };
  }

  const deletable = await checkStaffDeletable(supabase, profileId);
  if (!deletable.ok) {
    return { ok: false, message: deletable.error };
  }
  if (!deletable.deletable) {
    return { ok: false, message: STAFF_HAS_RECORDS_MESSAGE };
  }

  await recordAuditEvent({
    action: "staff_profile_deleted",
    actorUserId: actor.userId,
    metadata: {
      targetUserId: profileId,
      role: target.role,
      ...(target.email ? { email: target.email } : {}),
      ...(target.full_name ? { fullName: target.full_name } : {}),
    },
  });

  let adminClient: ReturnType<typeof createAdminSupabaseClient>;
  try {
    adminClient = createAdminSupabaseClient();
  } catch {
    return {
      ok: false,
      message:
        "Permanent delete requires server admin credentials. Deactivate the account instead.",
    };
  }

  // Deleting the auth user cascades to public.profiles (ON DELETE CASCADE).
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(profileId);
  if (deleteError) {
    return {
      ok: false,
      message: deleteError.message || "Could not permanently delete this account.",
    };
  }

  revalidatePath(staffDirectoryPath(actor.role));
  return { ok: true, message: "Staff account permanently deleted." };
}
