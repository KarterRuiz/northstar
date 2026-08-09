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
import { isUuid } from "@/lib/students/uuid";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthEmailRedirectToLogin } from "@/lib/supabase/env";
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

async function resolveLoginBase(): Promise<{ ok: true; base: string } | { ok: false; message: string }> {
  try {
    return { ok: true, base: getAuthEmailRedirectToLogin().replace(/\/$/, "") };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invalid site URL configuration.",
    };
  }
}

async function trySendInviteEmail(
  email: string,
  redirectTo: string,
): Promise<{ emailSent: boolean; authUserId?: string }> {
  let adminClient: ReturnType<typeof createAdminSupabaseClient> | null = null;
  try {
    adminClient = createAdminSupabaseClient();
  } catch {
    return { emailSent: false };
  }

  const { data: inviteAuth, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });

  if (inviteError) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[staff-invite] inviteUserByEmail:", inviteError.message);
    }
    return { emailSent: false };
  }

  const invitedUser = inviteAuth?.user;
  const authUserId =
    invitedUser?.id && normalizeEmail(invitedUser.email ?? "") === email
      ? invitedUser.id
      : undefined;

  return { emailSent: true, authUserId };
}

/**
 * Sends activation invitations for selected roster rows.
 * Creates/rotates staff_invitations and optionally emails via Auth Admin API.
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

  const loginResolved = await resolveLoginBase();
  if (!loginResolved.ok) {
    return { ok: false, message: loginResolved.message };
  }
  const baseLogin = loginResolved.base;

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
    .select("id, staff_member_id, status, expires_at, updated_at")
    .in("staff_member_id", uniqueIds)
    .order("updated_at", { ascending: false });

  const latestInviteByMember = new Map<
    string,
    { status: "pending" | "accepted" | "expired" | "cancelled"; expires_at: string | null }
  >();
  for (const inv of invites ?? []) {
    if (!inv.staff_member_id) continue;
    if (!latestInviteByMember.has(inv.staff_member_id)) {
      latestInviteByMember.set(inv.staff_member_id, {
        status: inv.status,
        expires_at: inv.expires_at,
      });
    }
  }

  const results: { staffMemberId: string; inviteUrl: string; emailSent: boolean }[] = [];
  let emailSentCount = 0;

  for (const member of members) {
    if (!isRole(member.role)) continue;
    const email = member.email ? normalizeEmail(member.email) : "";
    const latest = latestInviteByMember.get(member.id) ?? null;
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
    if (!email || !isValidEmailFormat(email)) {
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

    const inviteUrl = buildStaffInviteLink(baseLogin, inserted.invite_token);
    const sendResult = await trySendInviteEmail(email, baseLogin);

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
    emailSentCount === results.length
      ? "Invitation emails were sent."
      : emailSentCount > 0
        ? `${emailSentCount} of ${results.length} emails sent; copy links for the rest.`
        : "Invitation records created. Copy links to share if email is not configured.";

  return {
    ok: true,
    sentCount: results.length,
    emailSentCount,
    results,
    message: `Sent ${results.length} invitation${results.length === 1 ? "" : "s"}. ${emailNote}`,
  };
}

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
    .select("id, email, status, profile_id, archived_at")
    .eq("id", staffMemberId)
    .maybeSingle();
  if (!member) return { ok: false, message: "Staff member not found." };
  const memberEmail = member.email ? normalizeEmail(member.email) : "";
  if (!memberEmail || !isValidEmailFormat(memberEmail)) {
    return {
      ok: false,
      message: "Add an email address before sending an invitation.",
    };
  }

  const { data: pending } = await supabase
    .from("staff_invitations")
    .select("id, status, expires_at, invite_token, email")
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending && staffInvitationDisplayStatus(pending) === "pending") {
    const loginResolved = await resolveLoginBase();
    if (!loginResolved.ok) return { ok: false, message: loginResolved.message };

    const nowIso = new Date().toISOString();
    const inviteToken = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const inviteEmail = normalizeEmail(pending.email || memberEmail);

    const { error } = await supabase
      .from("staff_invitations")
      .update({
        email: inviteEmail,
        invite_token: inviteToken,
        expires_at: expiresAt,
        sent_at: nowIso,
        opened_at: null,
      })
      .eq("id", pending.id);

    if (error) {
      return { ok: false, message: "Could not resend the invitation." };
    }

    const inviteUrl = buildStaffInviteLink(loginResolved.base, inviteToken);
    const sendResult = await trySendInviteEmail(inviteEmail, loginResolved.base);

    await recordAuditEvent({
      action: "staff_invited",
      actorUserId: actor.userId,
      metadata: {
        invitationId: pending.id,
        email: inviteEmail,
        fullName: "",
        role: "",
        staffMemberId,
        op: "resend",
      },
    });

    revalidatePath(staffDirectoryPath(actor.role));
    return {
      ok: true,
      sentCount: 1,
      emailSentCount: sendResult.emailSent ? 1 : 0,
      results: [{ staffMemberId, inviteUrl, emailSent: sendResult.emailSent }],
      message: sendResult.emailSent
        ? "Invitation resent."
        : "Invitation renewed. Copy the link to share it.",
    };
  }

  // No live pending invite — create a new one via bulk path.
  const fd = new FormData();
  fd.append("staffMemberIds", staffMemberId);
  return sendStaffInvitationsAction(undefined, fd);
}
