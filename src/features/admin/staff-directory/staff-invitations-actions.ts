"use server";

import { revalidatePath } from "next/cache";

import { isRole } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";
import { profileFieldsFromStaffInvitation } from "@/lib/staff/profile-fields-from-invitation";
import { isUuid } from "@/lib/students/uuid";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthEmailRedirectToLogin } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function messageForInviteUserByEmailError(rawMessage: string | undefined): string {
  const trimmed = rawMessage?.trim() ?? "";
  if (/invalid api key/i.test(trimmed)) {
    return (
      "The server email key was rejected. Check the service role secret in your environment " +
      "and restart the dev server after updating `.env.local`."
    );
  }
  return (
    trimmed ||
    "The sign-up email could not be sent. The invitation is still pending — share the sign-in link below, or link an existing account."
  );
}

export type StaffInvitationActionState =
  | {
      ok: true;
      message?: string;
      /** When true, the platform sent a sign-up email; otherwise use copied links. */
      emailSent?: boolean;
      loginUrl: string;
      invitedEmail: string;
      recoveryUrl: string;
      setupSummary: string;
    }
  | { ok: false; message: string };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function parsePendingClassIds(formData: FormData): string[] {
  const raw = formData.getAll("classIds");
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (isUuid(id)) out.push(id);
  }
  return [...new Set(out)];
}

function composeFullName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(" ").trim();
}

export async function createStaffInvitationAction(
  _prev: StaffInvitationActionState | undefined,
  formData: FormData,
): Promise<StaffInvitationActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return {
      ok: false,
      message: "You must be signed in with permission to manage staff invitations.",
    };
  }

  const firstNameRaw = formData.get("firstName");
  const lastNameRaw = formData.get("lastName");
  const emailRaw = formData.get("email");
  const roleRaw = formData.get("role");
  const noteRaw = formData.get("staffNote");

  if (
    typeof firstNameRaw !== "string" ||
    typeof lastNameRaw !== "string" ||
    typeof emailRaw !== "string" ||
    typeof roleRaw !== "string"
  ) {
    return { ok: false, message: "Missing name, email, or role." };
  }

  const firstName = firstNameRaw.trim();
  const lastName = lastNameRaw.trim();
  const fullName = composeFullName(firstName, lastName);
  const email = normalizeEmail(emailRaw);
  const role = roleRaw.trim();
  const staffNote =
    typeof noteRaw === "string" && noteRaw.trim().length > 0 ? noteRaw.trim() : null;

  if (!firstName || !lastName) {
    return { ok: false, message: "First and last name are required." };
  }
  if (!fullName) {
    return { ok: false, message: "Name is required." };
  }
  if (!email) {
    return { ok: false, message: "Email is required." };
  }
  if (!isRole(role)) {
    return { ok: false, message: "That role is not allowed." };
  }

  const pendingClassIds = role === "teacher" ? parsePendingClassIds(formData) : [];

  let redirectTo: string;
  try {
    redirectTo = getAuthEmailRedirectToLogin();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invalid site URL configuration.",
    };
  }

  const baseLogin = redirectTo.replace(/\/$/, "");
  const recoveryPath = `${baseLogin}?staff_invite=`;

  const { data: inserted, error } = await supabase
    .from("staff_invitations")
    .insert({
      email,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      role,
      invited_by: actor.userId,
      status: "pending",
      staff_note: staffNote,
      pending_class_ids: pendingClassIds,
    })
    .select("id, invite_token")
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
  if (!inserted?.id || !inserted.invite_token) {
    return { ok: false, message: "Invitation was not created." };
  }

  const recoveryUrl = `${recoveryPath}${encodeURIComponent(inserted.invite_token)}`;

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

  let adminClient: ReturnType<typeof createAdminSupabaseClient> | null = null;
  try {
    adminClient = createAdminSupabaseClient();
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[staff-invite] No admin client:", e);
    }
  }

  let emailSent = false;
  let inviteErrorMessage: string | undefined;
  if (adminClient) {
    const { data: inviteAuth, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo,
      });
    emailSent = !inviteError;
    inviteErrorMessage = inviteError?.message;
    if (inviteError && process.env.NODE_ENV === "development") {
      console.warn("[staff-invite] inviteUserByEmail:", inviteError.message);
    }

    const invitedUser = inviteAuth?.user;
    if (invitedUser?.id && emailSent) {
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
  } else {
    inviteErrorMessage = "Missing server email credentials; cannot send automated sign-up messages.";
  }

  revalidatePath(staffDirectoryPath(actor.role));

  const setupSummary = [
    `Invitation recorded for ${fullName} (${email}) as ${role}.`,
    pendingClassIds.length > 0 && role === "teacher"
      ? `${pendingClassIds.length} class(es) will attach when they first sign in with this email.`
      : null,
    "After their account exists, their profile and dashboard role sync on first sign-in.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ok: true,
    emailSent,
    message: emailSent
      ? "Sign-up email sent. Share the recovery link as a backup."
      : messageForInviteUserByEmailError(inviteErrorMessage),
    loginUrl: baseLogin,
    invitedEmail: email,
    recoveryUrl,
    setupSummary,
  };
}

export async function cancelStaffInvitationAction(
  _prev: StaffInvitationActionState | undefined,
  formData: FormData,
): Promise<StaffInvitationActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return {
      ok: false,
      message: "You must be signed in with permission to manage staff invitations.",
    };
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

  revalidatePath(staffDirectoryPath(actor.role));
  return {
    ok: true,
    message: "Invitation cancelled.",
    loginUrl: "",
    invitedEmail: "",
    recoveryUrl: "",
    setupSummary: "",
  };
}

export async function linkStaffProfileFromInvitationAction(
  _prev: StaffInvitationActionState | undefined,
  formData: FormData,
): Promise<StaffInvitationActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return {
      ok: false,
      message: "You must be signed in with permission to manage staff invitations.",
    };
  }

  const invitationIdRaw = formData.get("invitationId");
  const authUserIdRaw = formData.get("authUserId");
  if (typeof invitationIdRaw !== "string" || typeof authUserIdRaw !== "string") {
    return { ok: false, message: "Missing invitation or user id." };
  }

  const invitationId = invitationIdRaw.trim();
  const authUserId = authUserIdRaw.trim();
  if (!isUuid(invitationId) || !isUuid(authUserId)) {
    return { ok: false, message: "Invitation id and account user id must be valid UUIDs." };
  }

  const { data: invite, error: inviteError } = await supabase
    .from("staff_invitations")
    .select("id, status, role, email, full_name, first_name, last_name")
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
      message: "Only pending invitations can be linked to an account.",
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
          "No account exists with that user id. Create the user in your identity provider first, then paste their user id here.",
      };
    }
    return { ok: false, message: upsertError.message };
  }

  const nowIso = new Date().toISOString();
  const { error: inviteUpdateError } = await supabase
    .from("staff_invitations")
    .update({
      status: "accepted",
      accepted_user_id: authUserId,
      accepted_at: nowIso,
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

  revalidatePath(staffDirectoryPath(actor.role));
  return {
    ok: true,
    message: "Profile linked and role applied from the invitation.",
    loginUrl: "",
    invitedEmail: "",
    recoveryUrl: "",
    setupSummary: "",
  };
}
