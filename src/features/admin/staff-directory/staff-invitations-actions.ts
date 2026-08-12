"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

import { isRole } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";
import { applyStaffInvitationAccess } from "@/lib/staff/apply-staff-invitation-access";
import { staffInvitationDisplayStatus } from "@/lib/staff/invitation-display-status";
import { profileFieldsFromStaffInvitation } from "@/lib/staff/profile-fields-from-invitation";
import { buildStaffInviteLink } from "@/lib/staff/staff-invite-link";
import { isUuid } from "@/lib/students/uuid";
import { messageForStaffInviteEmailFailure } from "@/lib/staff/staff-invite-email";
import { recoverExistingStaffAuthAccess } from "@/lib/staff/recover-existing-staff-auth";
import { resolveStaffAuthUser } from "@/lib/staff/resolve-staff-auth-user";
import { sendStaffAuthInviteEmail } from "@/lib/staff/send-staff-auth-invite";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resolveStaffAuthUrls } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidEmailFormat } from "@/lib/validation/is-valid-email-format";

function messageForInviteEmailFailure(rawMessage: string | undefined): string {
  return messageForStaffInviteEmailFailure(rawMessage);
}

export type StaffInvitationActionState =
  | {
      ok: true;
      message?: string;
      /** When true, the platform sent a sign-up email; otherwise use copied links. */
      emailSent?: boolean;
      loginUrl: string;
      invitedEmail: string;
      /** Sign-in / invite link (same token URL; previously labeled recovery). */
      recoveryUrl: string;
      inviteUrl: string;
      setupSummary: string;
    }
  | { ok: false; message: string };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function parseUuidFieldList(formData: FormData, fieldName: string): string[] {
  const raw = formData.getAll(fieldName);
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (isUuid(id)) out.push(id);
  }
  return [...new Set(out)];
}

function parsePendingClassIds(formData: FormData): string[] {
  return parseUuidFieldList(formData, "classIds");
}

function parsePendingGradeLevelIds(formData: FormData): string[] {
  return parseUuidFieldList(formData, "gradeLevelIds");
}

async function filterClassIdsToGrades(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  classIds: string[],
  gradeLevelIds: string[],
): Promise<string[]> {
  if (classIds.length === 0) return [];
  if (gradeLevelIds.length === 0) return [];
  const { data, error } = await supabase
    .from("classes")
    .select("id, grade_level_id")
    .in("id", classIds)
    .in("grade_level_id", gradeLevelIds);
  if (error || !data) return [];
  const allowed = new Set(data.map((r) => r.id));
  return classIds.filter((id) => allowed.has(id));
}

function composeFullName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(" ").trim();
}

function emptySuccessExtras(): Pick<
  Extract<StaffInvitationActionState, { ok: true }>,
  "loginUrl" | "invitedEmail" | "recoveryUrl" | "inviteUrl" | "setupSummary"
> {
  return {
    loginUrl: "",
    invitedEmail: "",
    recoveryUrl: "",
    inviteUrl: "",
    setupSummary: "",
  };
}

function resolveAuthUrls() {
  return resolveStaffAuthUrls();
}

async function trySendInviteEmail(
  email: string,
  /** Absolute `/auth/callback?next=/auth/setup-password` (must be allowlisted in Supabase). */
  redirectTo: string,
  opts?: { existingAuthUserId?: string | null; forResend?: boolean },
): Promise<{
  emailSent: boolean;
  errorMessage?: string;
  authUserId?: string;
  accountExists?: boolean;
}> {
  return sendStaffAuthInviteEmail({
    email,
    redirectTo,
    existingAuthUserId: opts?.existingAuthUserId,
    forResend: opts?.forResend,
  });
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
  if (!isValidEmailFormat(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!isRole(role)) {
    return { ok: false, message: "That role is not allowed." };
  }

  const pendingGradeLevelIds =
    role === "teacher" ? parsePendingGradeLevelIds(formData) : [];
  const rawPendingClassIds = role === "teacher" ? parsePendingClassIds(formData) : [];
  const pendingClassIds =
    role === "teacher"
      ? await filterClassIdsToGrades(supabase, rawPendingClassIds, pendingGradeLevelIds)
      : [];

  const urls = resolveAuthUrls();
  if (!urls.ok) {
    return { ok: false, message: urls.message };
  }
  const redirectTo = urls.redirectTo;
  const inviteLinkBase = urls.inviteLinkBase;

  // App-level guard (DB unique index also enforces one pending per email).
  const { data: existingPending, error: pendingLookupError } = await supabase
    .from("staff_invitations")
    .select("id, status, expires_at")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingLookupError) {
    return { ok: false, message: "Could not check existing invitations. Try again." };
  }
  if (existingPending) {
    const display = staffInvitationDisplayStatus(existingPending);
    if (display === "expired") {
      return {
        ok: false,
        message:
          "An expired invitation already exists for that email. Renew it from Pending Invitations, or withdraw it first.",
      };
    }
    return {
      ok: false,
      message:
        "A pending invitation already exists for that email. Resend or withdraw it first.",
    };
  }

  // Prefer linking to an existing roster row; otherwise create one (legacy Invite path).
  let staffMemberId: string | null = null;
  const { data: existingMember } = await supabase
    .from("staff_members")
    .select("id")
    .eq("email", email)
    .is("archived_at", null)
    .maybeSingle();
  if (existingMember?.id) {
    staffMemberId = existingMember.id;
  } else {
    const { data: createdMember } = await supabase
      .from("staff_members")
      .insert({
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        email,
        role,
        status: "ready",
        notes: staffNote,
        created_by: actor.userId,
      })
      .select("id")
      .maybeSingle();
    staffMemberId = createdMember?.id ?? null;
    if (staffMemberId && role === "teacher") {
      if (pendingGradeLevelIds.length > 0) {
        await supabase.from("staff_member_grade_levels").insert(
          pendingGradeLevelIds.map((grade_level_id) => ({
            staff_member_id: staffMemberId!,
            grade_level_id,
          })),
        );
      }
      if (pendingClassIds.length > 0) {
        await supabase.from("staff_member_classes").insert(
          pendingClassIds.map((class_id) => ({
            staff_member_id: staffMemberId!,
            class_id,
          })),
        );
      }
    }
  }

  const nowIso = new Date().toISOString();
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
      pending_grade_level_ids: pendingGradeLevelIds,
      staff_member_id: staffMemberId,
      sent_at: nowIso,
    })
    .select("id, invite_token")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message:
          "A pending invitation already exists for that email. Resend or withdraw it first.",
      };
    }
    return { ok: false, message: "Could not create the invitation. Try again." };
  }
  if (!inserted?.id || !inserted.invite_token) {
    return { ok: false, message: "Invitation was not created." };
  }

  const inviteUrl = buildStaffInviteLink(inviteLinkBase, inserted.invite_token);

  await recordAuditEvent({
    action: "staff_invited",
    actorUserId: actor.userId,
    metadata: {
      invitationId: inserted.id,
      email,
      fullName,
      role,
      ...(staffMemberId ? { staffMemberId } : {}),
    },
  });

  const sendResult = await trySendInviteEmail(email, redirectTo);

  if (sendResult.accountExists && sendResult.authUserId && staffMemberId) {
    const recovered = await recoverExistingStaffAuthAccess({
      staffMemberId,
      authUserId: sendResult.authUserId,
      email,
      redirectTo,
      actorUserId: actor.userId,
      fullName,
      role,
    });
    revalidatePath(staffDirectoryPath(actor.role));
    if (!recovered.ok) {
      return {
        ok: false,
        message: recovered.message,
      };
    }
    return {
      ok: true,
      emailSent: true,
      message: recovered.message,
      loginUrl: inviteLinkBase,
      invitedEmail: email,
      recoveryUrl: "",
      inviteUrl: "",
      setupSummary: "Existing account — setup link sent; staff record linked when safe.",
    };
  }

  if (sendResult.authUserId) {
    const { error: linkErr } = await supabase
      .from("staff_invitations")
      .update({ accepted_user_id: sendResult.authUserId })
      .eq("id", inserted.id)
      .eq("status", "pending");
    if (linkErr && process.env.NODE_ENV === "development") {
      console.warn(
        "[staff-invite] Could not store accepted_user_id on invitation:",
        linkErr.message,
      );
    }
  }

  revalidatePath(staffDirectoryPath(actor.role));

  const setupSummary = [
    `Invited ${fullName} (${email}) as ${role}.`,
    role === "teacher" && pendingGradeLevelIds.length > 0
      ? `${pendingGradeLevelIds.length} grade level(s) will attach on first sign-in.`
      : null,
    role === "teacher" && pendingClassIds.length > 0
      ? `${pendingClassIds.length} class(es) will attach on first sign-in.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ok: true,
    emailSent: sendResult.emailSent,
    message: sendResult.emailSent
      ? "Invitation sent. You can also copy the invite link as a backup."
      : messageForInviteEmailFailure(sendResult.errorMessage),
    loginUrl: inviteLinkBase,
    invitedEmail: email,
    recoveryUrl: inviteUrl,
    inviteUrl,
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
    .select("id, status, expires_at")
    .eq("id", invitationId)
    .maybeSingle();

  if (readError) {
    return { ok: false, message: "Could not load that invitation." };
  }
  if (!row) {
    return { ok: false, message: "Invitation not found." };
  }

  const display = staffInvitationDisplayStatus(row);
  if (display !== "pending" && display !== "expired") {
    return { ok: false, message: "Only pending or expired invitations can be withdrawn." };
  }
  if (row.status !== "pending" && row.status !== "expired") {
    return { ok: false, message: "Only pending or expired invitations can be withdrawn." };
  }

  const { error: updateError } = await supabase
    .from("staff_invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId)
    .in("status", ["pending", "expired"]);

  if (updateError) {
    return { ok: false, message: "Could not withdraw the invitation. Try again." };
  }

  revalidatePath(staffDirectoryPath(actor.role));
  return {
    ok: true,
    message: "Invitation withdrawn.",
    ...emptySuccessExtras(),
  };
}

/**
 * Edit a pending (or expired-but-still-pending-status) invitation's name/role/classes.
 * Email can be updated when no other active pending invite uses that address.
 * If an Auth invite was already sent to the old email, advise Resend after save.
 */
export async function updatePendingStaffInvitationAction(
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
  const firstNameRaw = formData.get("firstName");
  const lastNameRaw = formData.get("lastName");
  const emailRaw = formData.get("email");
  const roleRaw = formData.get("role");

  if (
    typeof idRaw !== "string" ||
    typeof firstNameRaw !== "string" ||
    typeof lastNameRaw !== "string" ||
    typeof emailRaw !== "string" ||
    typeof roleRaw !== "string"
  ) {
    return { ok: false, message: "Missing invitation fields." };
  }

  const invitationId = idRaw.trim();
  if (!isUuid(invitationId)) {
    return { ok: false, message: "Invalid invitation." };
  }

  const firstName = firstNameRaw.trim();
  const lastName = lastNameRaw.trim();
  const fullName = composeFullName(firstName, lastName);
  const email = normalizeEmail(emailRaw);
  const role = roleRaw.trim();

  if (!firstName || !lastName || !fullName) {
    return { ok: false, message: "First and last name are required." };
  }
  if (!email || !isValidEmailFormat(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!isRole(role)) {
    return { ok: false, message: "That role is not allowed." };
  }

  const pendingGradeLevelIds =
    role === "teacher" ? parsePendingGradeLevelIds(formData) : [];
  const rawPendingClassIds = role === "teacher" ? parsePendingClassIds(formData) : [];
  const pendingClassIds =
    role === "teacher"
      ? await filterClassIdsToGrades(supabase, rawPendingClassIds, pendingGradeLevelIds)
      : [];

  const { data: row, error: readError } = await supabase
    .from("staff_invitations")
    .select("id, email, status, expires_at")
    .eq("id", invitationId)
    .maybeSingle();

  if (readError || !row) {
    return { ok: false, message: "Invitation not found." };
  }

  const display = staffInvitationDisplayStatus(row);
  if (display !== "pending" && display !== "expired") {
    return {
      ok: false,
      message: "Only pending or expired invitations can be edited.",
    };
  }

  const previousEmail = normalizeEmail(row.email);
  const emailChanged = previousEmail !== email;

  if (emailChanged) {
    const { data: conflict, error: conflictError } = await supabase
      .from("staff_invitations")
      .select("id")
      .eq("email", email)
      .eq("status", "pending")
      .neq("id", invitationId)
      .maybeSingle();

    if (conflictError) {
      return { ok: false, message: "Could not check for duplicate invitations." };
    }
    if (conflict) {
      return {
        ok: false,
        message:
          "Another pending invitation already uses that email. Withdraw it first, or keep this invite’s email and Resend.",
      };
    }
  }

  const { error: updateError } = await supabase
    .from("staff_invitations")
    .update({
      email,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      role,
      pending_class_ids: pendingClassIds,
      pending_grade_level_ids: pendingGradeLevelIds,
    })
    .eq("id", invitationId)
    .in("status", ["pending", "expired"]);

  if (updateError) {
    if (updateError.code === "23505") {
      return {
        ok: false,
        message:
          "Another pending invitation already uses that email. Withdraw it first.",
      };
    }
    return { ok: false, message: "Could not update the invitation. Try again." };
  }

  revalidatePath(staffDirectoryPath(actor.role));

  return {
    ok: true,
    message: emailChanged
      ? "Invitation updated. Use Resend so the new email receives the invite link (avoids a duplicate pending invite)."
      : "Invitation updated.",
    ...emptySuccessExtras(),
  };
}

export async function resendStaffInvitationAction(
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
    .select("id, email, status, expires_at, invite_token, accepted_user_id, staff_member_id, full_name, role")
    .eq("id", invitationId)
    .maybeSingle();

  if (readError || !row) {
    return { ok: false, message: "Invitation not found." };
  }

  const display = staffInvitationDisplayStatus(row);
  if (display !== "pending") {
    return {
      ok: false,
      message:
        display === "expired"
          ? "This invitation has expired. Use Renew instead."
          : "Only pending invitations can be resent.",
    };
  }

  if (row.staff_member_id) {
    const { data: member } = await supabase
      .from("staff_members")
      .select("profile_id")
      .eq("id", row.staff_member_id)
      .maybeSingle();
    if (member?.profile_id) {
      return {
        ok: false,
        message: "This staff member already has an active account.",
      };
    }
  }

  const urls = resolveAuthUrls();
  if (!urls.ok) {
    return { ok: false, message: urls.message };
  }

  const inviteEmail = normalizeEmail(row.email);
  const resolvedAuth = await resolveStaffAuthUser({
    email: inviteEmail,
    knownAuthUserId: row.accepted_user_id,
  });

  if (resolvedAuth?.confirmed && row.staff_member_id) {
    const recovered = await recoverExistingStaffAuthAccess({
      staffMemberId: row.staff_member_id,
      authUserId: resolvedAuth.userId,
      email: inviteEmail,
      redirectTo: urls.redirectTo,
      actorUserId: actor.userId,
      fullName: row.full_name,
      role: row.role,
    });
    revalidatePath(staffDirectoryPath(actor.role));
    if (!recovered.ok) {
      return { ok: false, message: recovered.message };
    }
    return {
      ok: true,
      emailSent: true,
      message: recovered.message,
      loginUrl: urls.inviteLinkBase,
      invitedEmail: inviteEmail,
      recoveryUrl: "",
      inviteUrl: "",
      setupSummary: "Existing account — setup link sent.",
    };
  }

  if (resolvedAuth?.confirmed && !row.staff_member_id) {
    return {
      ok: false,
      message:
        "This account already exists. Link it from Advanced recovery, or attach a staff roster row first.",
    };
  }

  const sendResult = await trySendInviteEmail(row.email, urls.redirectTo, {
    existingAuthUserId: row.accepted_user_id,
    forResend: true,
  });
  const inviteUrl = buildStaffInviteLink(urls.inviteLinkBase, row.invite_token);

  if (sendResult.accountExists && sendResult.authUserId && row.staff_member_id) {
    const recovered = await recoverExistingStaffAuthAccess({
      staffMemberId: row.staff_member_id,
      authUserId: sendResult.authUserId,
      email: inviteEmail,
      redirectTo: urls.redirectTo,
      actorUserId: actor.userId,
      fullName: row.full_name,
      role: row.role,
    });
    revalidatePath(staffDirectoryPath(actor.role));
    if (!recovered.ok) {
      return { ok: false, message: recovered.message };
    }
    return {
      ok: true,
      emailSent: true,
      message: recovered.message,
      loginUrl: urls.inviteLinkBase,
      invitedEmail: inviteEmail,
      recoveryUrl: "",
      inviteUrl: "",
      setupSummary: "Existing account — setup link sent.",
    };
  }

  if (!sendResult.emailSent) {
    return {
      ok: false,
      message:
        sendResult.errorMessage ??
        messageForStaffInviteEmailFailure(undefined, { forResend: true }),
    };
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("staff_invitations")
    .update({
      sent_at: nowIso,
      opened_at: null,
      ...(sendResult.authUserId ? { accepted_user_id: sendResult.authUserId } : {}),
    })
    .eq("id", row.id);

  await recordAuditEvent({
    action: "staff_invitation_resent",
    actorUserId: actor.userId,
    metadata: {
      invitationId: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      ...(row.staff_member_id ? { staffMemberId: row.staff_member_id } : {}),
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));

  return {
    ok: true,
    emailSent: true,
    message: `Invitation resent to ${row.email}`,
    loginUrl: urls.inviteLinkBase,
    invitedEmail: row.email,
    recoveryUrl: inviteUrl,
    inviteUrl,
    setupSummary: "",
  };
}

export async function renewStaffInvitationAction(
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
    .select("id, email, status, expires_at, full_name, role")
    .eq("id", invitationId)
    .maybeSingle();

  if (readError || !row) {
    return { ok: false, message: "Invitation not found." };
  }

  const display = staffInvitationDisplayStatus(row);
  if (display !== "expired") {
    return {
      ok: false,
      message:
        display === "pending"
          ? "This invitation is still active. Use Resend instead."
          : "Only expired invitations can be renewed.",
    };
  }

  const urls = resolveAuthUrls();
  if (!urls.ok) {
    return { ok: false, message: urls.message };
  }

  const inviteToken = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("staff_invitations")
    .update({
      status: "pending",
      invite_token: inviteToken,
      expires_at: expiresAt,
      accepted_at: null,
    })
    .eq("id", invitationId)
    .in("status", ["pending", "expired"]);

  if (updateError) {
    if (updateError.code === "23505") {
      return {
        ok: false,
        message: "Another pending invitation already exists for that email.",
      };
    }
    return { ok: false, message: "Could not renew the invitation. Try again." };
  }

  const sendResult = await trySendInviteEmail(row.email, urls.redirectTo);
  const inviteUrl = buildStaffInviteLink(urls.inviteLinkBase, inviteToken);

  await recordAuditEvent({
    action: "staff_invited",
    actorUserId: actor.userId,
    metadata: {
      invitationId,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      renewed: true,
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));

  return {
    ok: true,
    emailSent: sendResult.emailSent,
    message: sendResult.emailSent
      ? "Invitation renewed and email sent."
      : messageForInviteEmailFailure(sendResult.errorMessage),
    loginUrl: urls.inviteLinkBase,
    invitedEmail: row.email,
    recoveryUrl: inviteUrl,
    inviteUrl,
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
    return { ok: false, message: "Missing invitation or account id." };
  }

  const invitationId = invitationIdRaw.trim();
  const authUserId = authUserIdRaw.trim();
  if (!isUuid(invitationId) || !isUuid(authUserId)) {
    return { ok: false, message: "Enter a valid account id." };
  }

  const { data: invite, error: inviteError } = await supabase
    .from("staff_invitations")
    .select(
      "id, status, role, email, full_name, first_name, last_name, pending_class_ids, pending_grade_level_ids",
    )
    .eq("id", invitationId)
    .maybeSingle();

  if (inviteError) {
    return { ok: false, message: "Could not load that invitation." };
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
    .select("id, role, full_name, email")
    .eq("id", authUserId)
    .maybeSingle();

  if (existingErr) {
    return { ok: false, message: "Could not look up that account." };
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

  const inviteFields = profileFieldsFromStaffInvitation(invite, authEmail);
  const full_name = existingProfile?.full_name?.trim() || inviteFields.full_name;
  const profileEmail = existingProfile?.email?.trim()
    ? normalizeEmail(existingProfile.email)
    : inviteFields.email;

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
        message: "No account exists with that id. Create the user first, then link.",
      };
    }
    return { ok: false, message: "Could not update the staff profile." };
  }

  await applyStaffInvitationAccess(supabase, {
    profileId: authUserId,
    role: invite.role,
    pendingClassIds: invite.pending_class_ids,
    pendingGradeLevelIds: invite.pending_grade_level_ids,
  });

  const nowIso = new Date().toISOString();
  const { error: inviteUpdateError } = await supabase
    .from("staff_invitations")
    .update({
      status: "accepted",
      accepted_user_id: authUserId,
      accepted_at: nowIso,
      pending_class_ids: [],
      pending_grade_level_ids: [],
    })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (inviteUpdateError) {
    return { ok: false, message: "Profile updated, but invitation status could not be saved." };
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
    message: "Account linked; role and access applied.",
    ...emptySuccessExtras(),
  };
}
