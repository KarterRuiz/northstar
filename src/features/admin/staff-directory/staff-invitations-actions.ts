"use server";

import { revalidatePath } from "next/cache";

import { isRole } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getAdminActor } from "@/lib/auth/require-admin";
import { profileFieldsFromStaffInvitation } from "@/lib/staff/profile-fields-from-invitation";
import { isUuid } from "@/lib/students/uuid";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthEmailRedirectToLogin } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const STAFF_DIRECTORY_PATH = "/dashboard/admin/teachers";

function messageForInviteUserByEmailError(rawMessage: string | undefined): string {
  const trimmed = rawMessage?.trim() ?? "";
  if (/invalid api key/i.test(trimmed)) {
    return (
      "Supabase rejected the server API key. Use SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY " +
      "(the service_role secret from Dashboard → Project Settings → API), not the anon key. " +
      "Restart `next dev` after changing `.env.local`."
    );
  }
  return (
    trimmed ||
    "Supabase could not send the invite email. The invitation is still pending — fix the issue or use “Link existing auth user”, then try again."
  );
}

export type StaffInvitationActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function createStaffInvitationAction(
  _prev: StaffInvitationActionState | undefined,
  formData: FormData,
): Promise<StaffInvitationActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getAdminActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in as an admin." };
  }

  const fullNameRaw = formData.get("fullName");
  const emailRaw = formData.get("email");
  const roleRaw = formData.get("role");
  if (
    typeof fullNameRaw !== "string" ||
    typeof emailRaw !== "string" ||
    typeof roleRaw !== "string"
  ) {
    return { ok: false, message: "Missing name, email, or role." };
  }

  const fullName = fullNameRaw.trim();
  const email = normalizeEmail(emailRaw);
  const role = roleRaw.trim();
  if (!fullName) {
    return { ok: false, message: "Full name is required." };
  }
  if (!email) {
    return { ok: false, message: "Email is required." };
  }
  if (!isRole(role)) {
    return { ok: false, message: "That role is not allowed." };
  }

  let redirectTo: string;
  try {
    redirectTo = getAuthEmailRedirectToLogin();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invalid site URL configuration.",
    };
  }

  let adminClient: ReturnType<typeof createAdminSupabaseClient>;
  try {
    adminClient = createAdminSupabaseClient();
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Missing service role key; cannot send email invites.",
    };
  }

  const { data: inserted, error } = await supabase
    .from("staff_invitations")
    .insert({
      email,
      full_name: fullName,
      role,
      invited_by: actor.userId,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message:
          "A pending invitation already exists for that email. Cancel it or use a different address.",
      };
    }
    return { ok: false, message: error.message };
  }
  if (!inserted?.id) {
    return { ok: false, message: "Invitation was not created." };
  }

  await recordAuditEvent({
    action: "staff_invited",
    actorUserId: actor.userId,
    metadata: {
      invitationId: inserted.id,
      email,
      fullName,
      role,
    },
  });

  const { data: inviteAuth, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

  if (inviteError) {
    revalidatePath(STAFF_DIRECTORY_PATH);
    return {
      ok: false,
      message: messageForInviteUserByEmailError(inviteError.message),
    };
  }

  // If Auth created or returned a user, record their id on the pending row when emails match.
  // Dashboard access still waits for `syncPendingStaffInvitationProfile` (after sign-in) to upsert
  // `profiles` and flip status to `accepted`; leaving status `pending` avoids treating the user as
  // fully onboarded before they have a session and profile row.
  const invitedUser = inviteAuth?.user;
  if (invitedUser?.id) {
    const authEmail = normalizeEmail(invitedUser.email ?? "");
    if (authEmail === email) {
      const { error: linkErr } = await supabase
        .from("staff_invitations")
        .update({ accepted_user_id: invitedUser.id })
        .eq("id", inserted.id)
        .eq("status", "pending");
      if (linkErr && process.env.NODE_ENV === "development") {
        console.warn("[staff-invite] Could not store accepted_user_id on invitation:", linkErr.message);
      }
    }
  }

  revalidatePath(STAFF_DIRECTORY_PATH);
  return {
    ok: true,
    message:
      "Invite email sent. After the staff member accepts, their dashboard role will be applied.",
  };
}

export async function cancelStaffInvitationAction(
  _prev: StaffInvitationActionState | undefined,
  formData: FormData,
): Promise<StaffInvitationActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getAdminActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in as an admin." };
  }

  const idRaw = formData.get("invitationId");
  if (typeof idRaw !== "string" || !isUuid(idRaw.trim())) {
    return { ok: false, message: "Invalid invitation." };
  }
  const invitationId = idRaw.trim();

  const { data: row, error: readError } = await supabase
    .from("staff_invitations")
    .select("id, status")
    .eq("id", invitationId)
    .maybeSingle();

  if (readError) {
    return { ok: false, message: readError.message };
  }
  if (!row) {
    return { ok: false, message: "Invitation not found." };
  }
  if (row.status !== "pending") {
    return { ok: false, message: "Only pending invitations can be cancelled." };
  }

  const { error: updateError } = await supabase
    .from("staff_invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidatePath(STAFF_DIRECTORY_PATH);
  return { ok: true, message: "Invitation cancelled." };
}

export async function linkStaffProfileFromInvitationAction(
  _prev: StaffInvitationActionState | undefined,
  formData: FormData,
): Promise<StaffInvitationActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getAdminActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in as an admin." };
  }

  const invitationIdRaw = formData.get("invitationId");
  const authUserIdRaw = formData.get("authUserId");
  if (typeof invitationIdRaw !== "string" || typeof authUserIdRaw !== "string") {
    return { ok: false, message: "Missing invitation or user id." };
  }

  const invitationId = invitationIdRaw.trim();
  const authUserId = authUserIdRaw.trim();
  if (!isUuid(invitationId) || !isUuid(authUserId)) {
    return { ok: false, message: "Invitation id and Auth user id must be valid UUIDs." };
  }

  const { data: invite, error: inviteError } = await supabase
    .from("staff_invitations")
    .select("id, status, role, email, full_name")
    .eq("id", invitationId)
    .maybeSingle();

  if (inviteError) {
    return { ok: false, message: inviteError.message };
  }
  if (!invite?.role || !isRole(invite.role)) {
    return { ok: false, message: "Invitation not found or role is invalid." };
  }
  if (invite.status !== "pending") {
    return {
      ok: false,
      message: "Only pending invitations can be linked to an Auth user.",
    };
  }

  const { data: existingProfile, error: existingErr } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", authUserId)
    .maybeSingle();

  if (existingErr) {
    return { ok: false, message: existingErr.message };
  }

  const previousRole = existingProfile?.role ?? null;

  let authEmail: string | null = null;
  try {
    const adminClient = createAdminSupabaseClient();
    const { data: authUser, error: authUserError } =
      await adminClient.auth.admin.getUserById(authUserId);
    if (!authUserError && authUser?.user?.email) {
      authEmail = authUser.user.email;
    }
  } catch {
    // Service role unavailable; invitation email/full_name still apply.
  }

  const { full_name, email: profileEmail } = profileFieldsFromStaffInvitation(
    invite,
    authEmail,
  );

  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: authUserId,
      role: invite.role,
      full_name,
      email: profileEmail,
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    if (upsertError.code === "23503") {
      return {
        ok: false,
        message:
          "No Auth user exists with that id. Create the user in the Supabase Dashboard (Authentication), then paste their User UUID here.",
      };
    }
    return { ok: false, message: upsertError.message };
  }

  const { error: inviteUpdateError } = await supabase
    .from("staff_invitations")
    .update({
      status: "accepted",
      accepted_user_id: authUserId,
    })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (inviteUpdateError) {
    return { ok: false, message: inviteUpdateError.message };
  }

  await recordAuditEvent({
    action: "staff_profile_linked",
    actorUserId: actor.userId,
    metadata: {
      invitationId,
      acceptedUserId: authUserId,
      role: invite.role,
      previousRole,
      invitationEmail: invite.email,
    },
  });

  revalidatePath(STAFF_DIRECTORY_PATH);
  return { ok: true, message: "Profile linked and role applied from the invitation." };
}
