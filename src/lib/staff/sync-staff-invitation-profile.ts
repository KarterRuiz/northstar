import "server-only";

import { cache } from "react";

import { isRole } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { applyStaffInvitationAccess } from "@/lib/staff/apply-staff-invitation-access";
import { profileFieldsFromStaffInvitation } from "@/lib/staff/profile-fields-from-invitation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * When a signed-in user's email matches a pending `staff_invitations` row, upserts `profiles.role`
 * from the invite, applies grade/class access from the linked staff_member (or pending_* arrays),
 * links staff_members.profile_id, and marks the invitation accepted.
 *
 * Deduped per request with `cache()`.
 */
export const syncPendingStaffInvitationProfile = cache(async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.email) return;

  const email = normalizeEmail(user.email);

  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[staff-invite] Skipping invitation sync: missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY.",
      );
    }
    return;
  }

  const { data: invite, error: inviteError } = await admin
    .from("staff_invitations")
    .select(
      "id, role, email, full_name, first_name, last_name, status, pending_class_ids, pending_grade_level_ids, expires_at, updated_at, staff_member_id",
    )
    .eq("email", email)
    .eq("status", "pending")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inviteError || !invite?.id || !isRole(invite.role)) return;

  if (invite.expires_at) {
    const ex = new Date(invite.expires_at).getTime();
    if (!Number.isNaN(ex) && ex < Date.now()) {
      return;
    }
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const inviteFields = profileFieldsFromStaffInvitation(invite, user.email);
  const full_name =
    existingProfile?.full_name?.trim() ||
    inviteFields.full_name?.trim() ||
    email;
  const profileEmail =
    (existingProfile?.email?.trim()
      ? normalizeEmail(existingProfile.email)
      : inviteFields.email?.trim()
        ? normalizeEmail(inviteFields.email)
        : email) || email;

  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      role: invite.role,
      full_name,
      email: profileEmail,
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (upsertError) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[staff-invite] Profile upsert failed during invitation sync:", upsertError.message);
    }
    return;
  }

  // Prefer roster junction tables; fall back to invitation pending_* for legacy rows.
  let pendingClassIds = invite.pending_class_ids ?? [];
  let pendingGradeLevelIds = invite.pending_grade_level_ids ?? [];

  if (invite.staff_member_id) {
    const [{ data: gradeRows }, { data: classRows }] = await Promise.all([
      admin
        .from("staff_member_grade_levels")
        .select("grade_level_id")
        .eq("staff_member_id", invite.staff_member_id),
      admin
        .from("staff_member_classes")
        .select("class_id")
        .eq("staff_member_id", invite.staff_member_id),
    ]);
    if (gradeRows?.length) {
      pendingGradeLevelIds = gradeRows.map((r) => r.grade_level_id);
    }
    if (classRows?.length) {
      pendingClassIds = classRows.map((r) => r.class_id);
    }

    await admin
      .from("staff_members")
      .update({
        profile_id: user.id,
        status: "ready",
        last_activity_at: new Date().toISOString(),
        full_name,
        email: profileEmail,
        role: invite.role,
        ...(invite.first_name?.trim() ? { first_name: invite.first_name.trim() } : {}),
        ...(invite.last_name?.trim() ? { last_name: invite.last_name.trim() } : {}),
      })
      .eq("id", invite.staff_member_id);
  } else {
    // Legacy invite without roster link: attach or create staff_members by email.
    const { data: byEmail } = await admin
      .from("staff_members")
      .select("id")
      .eq("email", email)
      .is("archived_at", null)
      .maybeSingle();

    if (byEmail?.id) {
      await admin
        .from("staff_members")
        .update({
          profile_id: user.id,
          status: "ready",
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", byEmail.id);
      await admin
        .from("staff_invitations")
        .update({ staff_member_id: byEmail.id })
        .eq("id", invite.id);
    }
  }

  await applyStaffInvitationAccess(admin, {
    profileId: user.id,
    role: invite.role,
    pendingClassIds,
    pendingGradeLevelIds,
  });

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateInviteError } = await admin
    .from("staff_invitations")
    .update({
      status: "accepted",
      accepted_user_id: user.id,
      accepted_at: nowIso,
      pending_class_ids: [],
      pending_grade_level_ids: [],
    })
    .eq("id", invite.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateInviteError || !updated) {
    return;
  }

  await recordAuditEvent({
    action: "staff_invite_accepted",
    actorUserId: user.id,
    metadata: {
      invitationId: invite.id,
      role: invite.role,
      email,
      staffMemberId: invite.staff_member_id,
    },
  });
});

/** Touch last_activity_at for linked roster rows on successful sign-in. */
export async function touchStaffMemberActivity(profileId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const admin = createAdminSupabaseClient();
    await admin
      .from("staff_members")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("profile_id", profileId);
  } catch {
    // Non-fatal.
  }
}
