import "server-only";

import { recordAuditEvent } from "@/lib/audit";
import { linkStaffMemberToAuthUser } from "@/lib/staff/link-staff-member-to-auth-user";
import { messageForStaffSetupLinkFailure } from "@/lib/staff/staff-invite-email";
import { sendStaffAuthSetupLink } from "@/lib/staff/send-staff-auth-setup-link";

export type RecoverExistingStaffAuthResult =
  | {
      ok: true;
      emailSent: boolean;
      linked: boolean;
      alreadyLinked: boolean;
      message: string;
      authUserId: string;
    }
  | { ok: false; message: string };

/**
 * For a confirmed Auth user: safely link to the staff row (when unambiguous),
 * then send a password reset / sign-in setup email. Never calls inviteUserByEmail.
 */
export async function recoverExistingStaffAuthAccess(args: {
  staffMemberId: string;
  authUserId: string;
  email: string;
  redirectTo: string;
  actorUserId: string;
  fullName?: string | null;
  role?: string | null;
}): Promise<RecoverExistingStaffAuthResult> {
  const linkResult = await linkStaffMemberToAuthUser({
    staffMemberId: args.staffMemberId,
    authUserId: args.authUserId,
    email: args.email,
    actorUserId: args.actorUserId,
  });

  if (!linkResult.ok) {
    // Still offer setup when already linked elsewhere is not the case — but if unsafe, stop.
    if (linkResult.unsafe) {
      return { ok: false, message: linkResult.message };
    }
    return { ok: false, message: linkResult.message };
  }

  const setup = await sendStaffAuthSetupLink({
    email: args.email,
    redirectTo: args.redirectTo,
  });

  await recordAuditEvent({
    action: "staff_setup_link_sent",
    actorUserId: args.actorUserId,
    metadata: {
      staffMemberId: args.staffMemberId,
      email: args.email,
      authUserId: args.authUserId,
      linked: linkResult.linked,
      alreadyLinked: linkResult.alreadyLinked,
      emailSent: setup.emailSent,
      ...(args.fullName ? { fullName: args.fullName } : {}),
      ...(args.role ? { role: args.role } : {}),
    },
  });

  if (!setup.emailSent) {
    const linkNote = linkResult.linked
      ? " The staff record was linked to the existing account."
      : linkResult.alreadyLinked
        ? " The staff record is already linked."
        : "";
    return {
      ok: false,
      message: `${setup.errorMessage ?? messageForStaffSetupLinkFailure(undefined)}${linkNote}`,
    };
  }

  const linkNote = linkResult.linked
    ? " Their staff record is now linked."
    : linkResult.alreadyLinked
      ? " Their staff record was already linked."
      : "";

  return {
    ok: true,
    emailSent: true,
    linked: linkResult.linked,
    alreadyLinked: linkResult.alreadyLinked,
    authUserId: args.authUserId,
    message: `Account already exists. Setup link sent to ${args.email}.${linkNote}`,
  };
}
