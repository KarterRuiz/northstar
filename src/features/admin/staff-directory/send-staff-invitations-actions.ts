"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

import { isRole } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";
import { staffInvitationDisplayStatus } from "@/lib/staff/invitation-display-status";
import { canSendStaffInvitation } from "@/lib/staff/staff-roster-status";
import { buildStaffInviteLink } from "@/lib/staff/staff-invite-link";
import { messageForStaffInviteEmailFailure } from "@/lib/staff/staff-invite-email";
import { recoverExistingStaffAuthAccess } from "@/lib/staff/recover-existing-staff-auth";
import { resolveStaffAuthUser } from "@/lib/staff/resolve-staff-auth-user";
import { sendStaffAuthInviteEmail } from "@/lib/staff/send-staff-auth-invite";
import { isUuid } from "@/lib/students/uuid";
import { resolveStaffAuthUrls } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidEmailFormat } from "@/lib/validation/is-valid-email-format";

export type SendStaffInvitationsState =
  | {
      ok: true;
      message: string;
      sentCount: number;
      emailSentCount: number;
      results: { staffMemberId: string; inviteUrl: string; emailSent: boolean }[];
    }
  | { ok: false; message: string };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function resolveAuthUrls() {
  return resolveStaffAuthUrls();
}

/**
 * Sends activation invitations for selected roster rows.
 * Creates/rotates staff_invitations and optionally emails via Auth Admin API.
 * Confirmed Auth accounts get a setup/reset link + safe roster linkage instead of inviteUserByEmail.
 */
export async function sendStaffInvitationsAction(
  _prev: SendStaffInvitationsState | undefined,
  formData: FormData,
): Promise<SendStaffInvitationsState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in with permission to manage staff." };
  }

  const ids = formData
    .getAll("staffMemberIds")
    .filter((v): v is string => typeof v === "string" && isUuid(v.trim()))
    .map((v) => v.trim());
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) {
    return { ok: false, message: "Select at least one staff member to invite." };
  }

  const urls = resolveAuthUrls();
  if (!urls.ok) {
    return { ok: false, message: urls.message };
  }
  const redirectTo = urls.redirectTo;
  const inviteLinkBase = urls.inviteLinkBase;

  const { data: members, error: membersError } = await supabase
    .from("staff_members")
    .select(
      "id, first_name, last_name, full_name, email, role, status, notes, profile_id, archived_at",
    )
    .in("id", uniqueIds);

  if (membersError || !members?.length) {
    return { ok: false, message: "Could not load selected staff." };
  }

  const { data: invites } = await supabase
    .from("staff_invitations")
    .select("id, staff_member_id, status, expires_at, updated_at, accepted_user_id")
    .in("staff_member_id", uniqueIds)
    .order("updated_at", { ascending: false });

  const latestInviteByMember = new Map<
    string,
    {
      status: "pending" | "accepted" | "expired" | "cancelled";
      expires_at: string | null;
      accepted_user_id: string | null;
    }
  >();
  for (const inv of invites ?? []) {
    if (!inv.staff_member_id) continue;
    if (!latestInviteByMember.has(inv.staff_member_id)) {
      latestInviteByMember.set(inv.staff_member_id, {
        status: inv.status,
        expires_at: inv.expires_at,
        accepted_user_id: inv.accepted_user_id,
      });
    }
  }

  const results: { staffMemberId: string; inviteUrl: string; emailSent: boolean }[] = [];
  let emailSentCount = 0;
  let setupCount = 0;

  for (const member of members) {
    if (!isRole(member.role)) continue;
    const email = member.email ? normalizeEmail(member.email) : "";
    const latest = latestInviteByMember.get(member.id) ?? null;
    if (!email || !isValidEmailFormat(email)) {
      continue;
    }

    // Detect confirmed Auth up front — never inviteUserByEmail for those emails.
    const existingAuth = await resolveStaffAuthUser({
      email,
      knownAuthUserId: latest?.accepted_user_id ?? null,
    });
    if (existingAuth?.confirmed && !member.profile_id) {
      const recovered = await recoverExistingStaffAuthAccess({
        staffMemberId: member.id,
        authUserId: existingAuth.userId,
        email,
        redirectTo,
        actorUserId: actor.userId,
        fullName: member.full_name,
        role: member.role,
      });
      if (recovered.ok) {
        setupCount += 1;
        emailSentCount += 1;
        results.push({ staffMemberId: member.id, inviteUrl: "", emailSent: true });
      }
      continue;
    }

    if (
      !canSendStaffInvitation({
        membershipStatus: member.status,
        archivedAt: member.archived_at,
        profileId: member.profile_id,
        email,
        latestInvite: latest,
      })
    ) {
      continue;
    }

    // Mark prior pending as cancelled before creating a fresh invite.
    await supabase
      .from("staff_invitations")
      .update({ status: "cancelled" })
      .eq("staff_member_id", member.id)
      .eq("status", "pending");

    const { data: gradeRows } = await supabase
      .from("staff_member_grade_levels")
      .select("grade_level_id")
      .eq("staff_member_id", member.id);
    const { data: classRows } = await supabase
      .from("staff_member_classes")
      .select("class_id")
      .eq("staff_member_id", member.id);

    const pendingGradeLevelIds = (gradeRows ?? []).map((r) => r.grade_level_id);
    const pendingClassIds = (classRows ?? []).map((r) => r.class_id);
    const nowIso = new Date().toISOString();
    const inviteToken = randomBytes(24).toString("hex");

    const { data: inserted, error: insertError } = await supabase
      .from("staff_invitations")
      .insert({
        email,
        full_name: member.full_name,
        first_name: member.first_name,
        last_name: member.last_name,
        role: member.role,
        invited_by: actor.userId,
        status: "pending",
        staff_note: member.notes,
        staff_member_id: member.id,
        pending_class_ids: pendingClassIds,
        pending_grade_level_ids: pendingGradeLevelIds,
        invite_token: inviteToken,
        sent_at: nowIso,
      })
      .select("id, invite_token")
      .maybeSingle();

    if (insertError || !inserted?.id || !inserted.invite_token) {
      continue;
    }

    // Promote draft → ready once invitation is issued.
    if (member.status === "draft") {
      await supabase.from("staff_members").update({ status: "ready" }).eq("id", member.id);
    }

    const inviteUrl = buildStaffInviteLink(inviteLinkBase, inserted.invite_token);
    const sendResult = await sendStaffAuthInviteEmail({
      email,
      redirectTo,
      existingAuthUserId: existingAuth?.userId ?? null,
    });

    if (sendResult.accountExists && sendResult.authUserId) {
      const recovered = await recoverExistingStaffAuthAccess({
        staffMemberId: member.id,
        authUserId: sendResult.authUserId,
        email,
        redirectTo,
        actorUserId: actor.userId,
        fullName: member.full_name,
        role: member.role,
      });
      if (recovered.ok) {
        setupCount += 1;
        emailSentCount += 1;
        results.push({ staffMemberId: member.id, inviteUrl: "", emailSent: true });
      }
      continue;
    }

    if (sendResult.authUserId) {
      await supabase
        .from("staff_invitations")
        .update({ accepted_user_id: sendResult.authUserId })
        .eq("id", inserted.id)
        .eq("status", "pending");
    }

    await recordAuditEvent({
      action: "staff_invited",
      actorUserId: actor.userId,
      metadata: {
        invitationId: inserted.id,
        email,
        fullName: member.full_name,
        role: member.role,
        staffMemberId: member.id,
      },
    });

    if (sendResult.emailSent) emailSentCount += 1;
    results.push({
      staffMemberId: member.id,
      inviteUrl,
      emailSent: sendResult.emailSent,
    });
  }

  if (results.length === 0) {
    return {
      ok: false,
      message:
        "None of the selected staff could be invited. Add an email first, or they may already be active / have a pending invitation.",
    };
  }

  revalidatePath(staffDirectoryPath(actor.role));

  const emailNote =
    setupCount === results.length
      ? "Existing accounts received setup links."
      : setupCount > 0
        ? `${setupCount} setup link${setupCount === 1 ? "" : "s"} and ${results.length - setupCount} invitation${results.length - setupCount === 1 ? "" : "s"} processed.`
        : emailSentCount === results.length
          ? "Invitation emails were sent."
          : emailSentCount > 0
            ? `${emailSentCount} of ${results.length} emails sent; copy links for the rest.`
            : "Invitation records created. Copy links to share if email is not configured.";

  return {
    ok: true,
    sentCount: results.length,
    emailSentCount,
    results,
    message: `Processed ${results.length} staff member${results.length === 1 ? "" : "s"}. ${emailNote}`,
  };
}

/**
 * Resends a Supabase Auth invitation for an existing pending staff member,
 * or sends a setup/reset link when the Auth account is already confirmed.
 * Preserves the staff_members row and all assignments; does not create duplicates.
 */
export async function resendStaffMemberInvitationAction(
  _prev: SendStaffInvitationsState | undefined,
  formData: FormData,
): Promise<SendStaffInvitationsState> {
  const idRaw = formData.get("staffMemberId");
  if (typeof idRaw !== "string" || !isUuid(idRaw.trim())) {
    return { ok: false, message: "Invalid staff member." };
  }

  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in with permission to manage staff." };
  }

  const staffMemberId = idRaw.trim();

  const { data: member } = await supabase
    .from("staff_members")
    .select("id, email, full_name, role, status, profile_id, archived_at")
    .eq("id", staffMemberId)
    .maybeSingle();
  if (!member) return { ok: false, message: "Staff member not found." };

  if (member.profile_id) {
    return {
      ok: false,
      message: "This staff member already has an active account.",
    };
  }
  if (member.archived_at || member.status === "archived" || member.status === "disabled") {
    return { ok: false, message: "Archived or disabled staff cannot receive invitations." };
  }

  const memberEmail = member.email ? normalizeEmail(member.email) : "";
  if (!memberEmail || !isValidEmailFormat(memberEmail)) {
    return {
      ok: false,
      message: "Add an email address before sending an invitation.",
    };
  }

  const urls = resolveAuthUrls();
  if (!urls.ok) return { ok: false, message: urls.message };

  const { data: pending } = await supabase
    .from("staff_invitations")
    .select("id, status, expires_at, invite_token, email, accepted_user_id")
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const inviteEmail = normalizeEmail(pending?.email || memberEmail);

  // Prefer Auth truth over invitation status for confirmed accounts.
  const resolvedAuth = await resolveStaffAuthUser({
    email: inviteEmail,
    knownAuthUserId: pending?.accepted_user_id ?? null,
  });

  if (resolvedAuth?.confirmed) {
    const recovered = await recoverExistingStaffAuthAccess({
      staffMemberId,
      authUserId: resolvedAuth.userId,
      email: inviteEmail,
      redirectTo: urls.redirectTo,
      actorUserId: actor.userId,
      fullName: member.full_name,
      role: member.role,
    });
    revalidatePath(staffDirectoryPath(actor.role));
    if (!recovered.ok) {
      return { ok: false, message: recovered.message };
    }
    return {
      ok: true,
      sentCount: 1,
      emailSentCount: 1,
      results: [{ staffMemberId, inviteUrl: "", emailSent: true }],
      message: recovered.message,
    };
  }

  if (pending && staffInvitationDisplayStatus(pending) === "pending") {
    const inviteToken = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const inviteUrl = buildStaffInviteLink(urls.inviteLinkBase, inviteToken);

    // Send Auth email first — do not mark resent if delivery fails.
    const sendResult = await sendStaffAuthInviteEmail({
      email: inviteEmail,
      redirectTo: urls.redirectTo,
      existingAuthUserId: pending.accepted_user_id ?? resolvedAuth?.userId ?? null,
      forResend: true,
    });

    if (sendResult.accountExists && sendResult.authUserId) {
      const recovered = await recoverExistingStaffAuthAccess({
        staffMemberId,
        authUserId: sendResult.authUserId,
        email: inviteEmail,
        redirectTo: urls.redirectTo,
        actorUserId: actor.userId,
        fullName: member.full_name,
        role: member.role,
      });
      revalidatePath(staffDirectoryPath(actor.role));
      if (!recovered.ok) {
        return { ok: false, message: recovered.message };
      }
      return {
        ok: true,
        sentCount: 1,
        emailSentCount: 1,
        results: [{ staffMemberId, inviteUrl: "", emailSent: true }],
        message: recovered.message,
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
    const { error } = await supabase
      .from("staff_invitations")
      .update({
        email: inviteEmail,
        invite_token: inviteToken,
        expires_at: expiresAt,
        sent_at: nowIso,
        opened_at: null,
        ...(sendResult.authUserId ? { accepted_user_id: sendResult.authUserId } : {}),
      })
      .eq("id", pending.id);

    if (error) {
      // Email already left Supabase — surface a soft warning with the copy link.
      revalidatePath(staffDirectoryPath(actor.role));
      return {
        ok: true,
        sentCount: 1,
        emailSentCount: 1,
        results: [{ staffMemberId, inviteUrl, emailSent: true }],
        message: `Invitation resent to ${inviteEmail}. (Invite record could not be refreshed — copy the link if needed.)`,
      };
    }

    await recordAuditEvent({
      action: "staff_invitation_resent",
      actorUserId: actor.userId,
      metadata: {
        invitationId: pending.id,
        email: inviteEmail,
        fullName: member.full_name,
        role: member.role,
        staffMemberId,
      },
    });

    revalidatePath(staffDirectoryPath(actor.role));
    return {
      ok: true,
      sentCount: 1,
      emailSentCount: 1,
      results: [{ staffMemberId, inviteUrl, emailSent: true }],
      message: `Invitation resent to ${inviteEmail}`,
    };
  }

  // No live pending invite — create a new one via bulk path (still same staff_members row).
  const fd = new FormData();
  fd.append("staffMemberIds", staffMemberId);
  return sendStaffInvitationsAction(undefined, fd);
}

/**
 * Sends a sign-in setup / password reset link for a confirmed Auth account
 * linked (or safely linkable) to this staff member. Never calls inviteUserByEmail.
 */
export async function sendStaffMemberSetupLinkAction(
  _prev: SendStaffInvitationsState | undefined,
  formData: FormData,
): Promise<SendStaffInvitationsState> {
  const idRaw = formData.get("staffMemberId");
  if (typeof idRaw !== "string" || !isUuid(idRaw.trim())) {
    return { ok: false, message: "Invalid staff member." };
  }

  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in with permission to manage staff." };
  }

  const staffMemberId = idRaw.trim();
  const { data: member } = await supabase
    .from("staff_members")
    .select("id, email, full_name, role, status, profile_id, archived_at")
    .eq("id", staffMemberId)
    .maybeSingle();
  if (!member) return { ok: false, message: "Staff member not found." };

  if (member.archived_at || member.status === "archived" || member.status === "disabled") {
    return { ok: false, message: "Archived or disabled staff cannot receive setup links." };
  }

  const memberEmail = member.email ? normalizeEmail(member.email) : "";
  if (!memberEmail || !isValidEmailFormat(memberEmail)) {
    return { ok: false, message: "Add an email address before sending a setup link." };
  }

  const urls = resolveAuthUrls();
  if (!urls.ok) return { ok: false, message: urls.message };

  const { data: pending } = await supabase
    .from("staff_invitations")
    .select("accepted_user_id")
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const knownId = member.profile_id ?? pending?.accepted_user_id ?? null;
  const resolvedAuth = await resolveStaffAuthUser({
    email: memberEmail,
    knownAuthUserId: knownId,
  });

  if (!resolvedAuth) {
    return {
      ok: false,
      message: "No existing account found for this email. Send an invitation instead.",
    };
  }
  if (!resolvedAuth.confirmed) {
    return {
      ok: false,
      message: "This account is still pending. Use Resend invitation instead.",
    };
  }

  const recovered = await recoverExistingStaffAuthAccess({
    staffMemberId,
    authUserId: resolvedAuth.userId,
    email: memberEmail,
    redirectTo: urls.redirectTo,
    actorUserId: actor.userId,
    fullName: member.full_name,
    role: member.role,
  });

  revalidatePath(staffDirectoryPath(actor.role));
  if (!recovered.ok) {
    return { ok: false, message: recovered.message };
  }

  return {
    ok: true,
    sentCount: 1,
    emailSentCount: 1,
    results: [{ staffMemberId, inviteUrl: "", emailSent: true }],
    message: recovered.message,
  };
}
