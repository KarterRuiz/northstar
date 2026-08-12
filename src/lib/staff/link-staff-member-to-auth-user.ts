import "server-only";

import { isRole } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { applyStaffInvitationAccess } from "@/lib/staff/apply-staff-invitation-access";
import { profileFieldsFromStaffInvitation } from "@/lib/staff/profile-fields-from-invitation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type LinkStaffMemberToAuthUserResult =
  | {
      ok: true;
      linked: boolean;
      alreadyLinked: boolean;
      profileId: string;
      invitationId?: string;
    }
  | { ok: false; message: string; unsafe?: boolean };

/**
 * Safely attach an existing confirmed Auth user to a staff_members row.
 * Preserves staff member id, role, and grade/class assignments.
 * Does not create duplicate staff_members or Auth users.
 *
 * Unsafe (no guess): Auth email mismatch, or Auth user already linked to a different staff row.
 */
export async function linkStaffMemberToAuthUser(args: {
  staffMemberId: string;
  authUserId: string;
  email: string;
  actorUserId: string;
}): Promise<LinkStaffMemberToAuthUserResult> {
  const email = normalizeEmail(args.email);
  const authUserId = args.authUserId.trim();
  const staffMemberId = args.staffMemberId.trim();

  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    return { ok: false, message: "Server configuration is missing for account linking." };
  }

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(authUserId);
  if (authError || !authUser?.user) {
    return { ok: false, message: "Could not verify the existing account." };
  }

  const authEmail = normalizeEmail(authUser.user.email ?? "");
  if (!authEmail || authEmail !== email) {
    return {
      ok: false,
      unsafe: true,
      message:
        "The existing account email does not match this staff record. Link manually from Pending Invitations if needed.",
    };
  }

  if (!authUser.user.email_confirmed_at) {
    return {
      ok: false,
      message: "This account is still pending confirmation. Use Resend invitation instead.",
    };
  }

  const { data: member, error: memberError } = await admin
    .from("staff_members")
    .select(
      "id, email, full_name, first_name, last_name, role, status, profile_id, archived_at, notes",
    )
    .eq("id", staffMemberId)
    .maybeSingle();

  if (memberError || !member) {
    return { ok: false, message: "Staff member not found." };
  }
  if (member.archived_at || member.status === "archived" || member.status === "disabled") {
    return { ok: false, message: "Archived or disabled staff cannot be linked." };
  }
  if (!isRole(member.role)) {
    return { ok: false, message: "Staff role is invalid." };
  }

  if (member.profile_id && member.profile_id !== authUserId) {
    return {
      ok: false,
      unsafe: true,
      message: "This staff record is already linked to a different account.",
    };
  }

  const { data: otherLinked } = await admin
    .from("staff_members")
    .select("id, full_name")
    .eq("profile_id", authUserId)
    .neq("id", staffMemberId)
    .is("archived_at", null)
    .maybeSingle();

  if (otherLinked?.id) {
    return {
      ok: false,
      unsafe: true,
      message: `This account is already linked to another staff record (${otherLinked.full_name}).`,
    };
  }

  if (member.profile_id === authUserId) {
    return {
      ok: true,
      linked: false,
      alreadyLinked: true,
      profileId: authUserId,
    };
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", authUserId)
    .maybeSingle();

  const inviteFields = profileFieldsFromStaffInvitation(
    {
      full_name: member.full_name,
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email ?? email,
    },
    authEmail,
  );
  const full_name =
    existingProfile?.full_name?.trim() ||
    inviteFields.full_name?.trim() ||
    member.full_name;
  const profileEmail =
    (existingProfile?.email?.trim()
      ? normalizeEmail(existingProfile.email)
      : inviteFields.email) || email;

  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      id: authUserId,
      role: member.role,
      full_name,
      email: profileEmail,
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (upsertError) {
    return { ok: false, message: "Could not update the staff profile for this account." };
  }

  const [{ data: gradeRows }, { data: classRows }, { data: pendingInvite }] = await Promise.all([
    admin
      .from("staff_member_grade_levels")
      .select("grade_level_id")
      .eq("staff_member_id", staffMemberId),
    admin
      .from("staff_member_classes")
      .select("class_id")
      .eq("staff_member_id", staffMemberId),
    admin
      .from("staff_invitations")
      .select("id, pending_class_ids, pending_grade_level_ids, status")
      .eq("staff_member_id", staffMemberId)
      .eq("status", "pending")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let pendingClassIds = (classRows ?? []).map((r) => r.class_id);
  let pendingGradeLevelIds = (gradeRows ?? []).map((r) => r.grade_level_id);
  if (!pendingClassIds.length && pendingInvite?.pending_class_ids?.length) {
    pendingClassIds = pendingInvite.pending_class_ids;
  }
  if (!pendingGradeLevelIds.length && pendingInvite?.pending_grade_level_ids?.length) {
    pendingGradeLevelIds = pendingInvite.pending_grade_level_ids;
  }

  const { error: linkError } = await admin
    .from("staff_members")
    .update({
      profile_id: authUserId,
      status: "ready",
      last_activity_at: new Date().toISOString(),
      email: profileEmail,
      full_name,
    })
    .eq("id", staffMemberId)
    .is("profile_id", null);

  if (linkError) {
    if (linkError.code === "23505") {
      return {
        ok: false,
        unsafe: true,
        message: "This account is already linked to another staff record.",
      };
    }
    return { ok: false, message: "Could not link the account to this staff record." };
  }

  // Confirm link stuck (race if another writer set profile_id).
  const { data: linkedRow } = await admin
    .from("staff_members")
    .select("profile_id")
    .eq("id", staffMemberId)
    .maybeSingle();
  if (linkedRow?.profile_id !== authUserId) {
    return {
      ok: false,
      unsafe: true,
      message: "Could not link safely — the staff record may have changed. Refresh and try again.",
    };
  }

  await applyStaffInvitationAccess(admin, {
    profileId: authUserId,
    role: member.role,
    pendingClassIds,
    pendingGradeLevelIds,
  });

  let invitationId: string | undefined;
  if (pendingInvite?.id) {
    const nowIso = new Date().toISOString();
    const { data: updatedInvite } = await admin
      .from("staff_invitations")
      .update({
        status: "accepted",
        accepted_user_id: authUserId,
        accepted_at: nowIso,
        pending_class_ids: [],
        pending_grade_level_ids: [],
      })
      .eq("id", pendingInvite.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    invitationId = updatedInvite?.id ?? pendingInvite.id;
  }

  await recordAuditEvent({
    action: "staff_profile_linked",
    actorUserId: args.actorUserId,
    metadata: {
      invitationId: invitationId ?? staffMemberId,
      acceptedUserId: authUserId,
      role: member.role,
      previousRole: existingProfile?.role ?? null,
      invitationEmail: email,
      staffMemberId,
      source: "existing_auth_account",
    },
  });

  return {
    ok: true,
    linked: true,
    alreadyLinked: false,
    profileId: authUserId,
    invitationId,
  };
}
