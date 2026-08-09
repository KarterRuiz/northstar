import type { StatusKind } from "@/components/ui/status-badge";
import type { Database } from "@/types/database.types";
import { staffInvitationDisplayStatus } from "@/lib/staff/invitation-display-status";

type MembershipStatus = Database["public"]["Tables"]["staff_members"]["Row"]["status"];
type InvitationStatus = Database["public"]["Tables"]["staff_invitations"]["Row"]["status"];

/**
 * Directory invitation/lifecycle badge — mapped only from real membership,
 * invitation, and profile access fields (no invented intermediates).
 * "Opened" is only used when staff_invitations.opened_at is set.
 */
export type StaffRosterDisplayStatus =
  | "draft"
  | "ready"
  | "invitation_sent"
  | "opened"
  | "accepted"
  | "active"
  | "disabled"
  | "archived";

export function resolveStaffRosterDisplayStatus(input: {
  membershipStatus: MembershipStatus;
  archivedAt?: string | null;
  profileId?: string | null;
  profileIsActive?: boolean | null;
  latestInvite?: {
    status: InvitationStatus;
    expires_at?: string | null;
    opened_at?: string | null;
    accepted_at?: string | null;
  } | null;
}): StaffRosterDisplayStatus {
  if (input.archivedAt || input.membershipStatus === "archived") {
    return "archived";
  }
  if (input.membershipStatus === "disabled") {
    return "disabled";
  }
  if (input.profileId) {
    if (input.profileIsActive === false) return "disabled";
    return "active";
  }

  const invite = input.latestInvite;
  if (invite) {
    const display = staffInvitationDisplayStatus(invite);
    if (display === "accepted") return "accepted";
    if (display === "pending") {
      return invite.opened_at ? "opened" : "invitation_sent";
    }
  }

  if (input.membershipStatus === "draft") return "draft";
  return "ready";
}

export function staffRosterStatusLabel(status: StaffRosterDisplayStatus): string {
  switch (status) {
    case "draft":
      return "Draft / Not Invited";
    case "ready":
      return "Ready";
    case "invitation_sent":
      return "Invitation Sent";
    case "opened":
      return "Opened";
    case "accepted":
      return "Accepted";
    case "active":
      return "Active";
    case "disabled":
      return "Disabled";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

export function staffRosterStatusKind(status: StaffRosterDisplayStatus): StatusKind {
  switch (status) {
    case "active":
      return "active";
    case "accepted":
      return "healthy";
    case "invitation_sent":
    case "opened":
      return "pending";
    case "ready":
      return "not_started";
    case "draft":
      return "inactive";
    case "disabled":
    case "archived":
      return "archived";
    default:
      return "inactive";
  }
}

/**
 * Membership row status after an edit (not display status).
 * Invitation lifecycle stays on staff_invitations; linked accounts stay ready
 * while display resolves to Active from profile_id.
 */
export function resolveStaffMembershipStatusAfterEdit(input: {
  currentStatus: MembershipStatus;
  hasEmail: boolean;
}): MembershipStatus {
  if (input.currentStatus === "archived") return "archived";
  if (input.currentStatus === "disabled") return "disabled";
  return input.hasEmail ? "ready" : "draft";
}

/** Eligible for bulk/manual send: draft/ready, has email, no active profile, no live pending invite. */
export function canSendStaffInvitation(input: {
  membershipStatus: MembershipStatus;
  archivedAt?: string | null;
  profileId?: string | null;
  email?: string | null;
  latestInvite?: {
    status: InvitationStatus;
    expires_at?: string | null;
  } | null;
}): boolean {
  if (input.archivedAt || input.membershipStatus === "archived") return false;
  if (input.membershipStatus === "disabled") return false;
  if (input.profileId) return false;
  if (!input.email?.trim()) return false;
  if (input.latestInvite) {
    const display = staffInvitationDisplayStatus(input.latestInvite);
    if (display === "pending") return false;
  }
  return input.membershipStatus === "draft" || input.membershipStatus === "ready";
}

export function staffInvitationIneligibilityReason(input: {
  membershipStatus: MembershipStatus;
  archivedAt?: string | null;
  profileId?: string | null;
  email?: string | null;
  latestInvite?: {
    status: InvitationStatus;
    expires_at?: string | null;
  } | null;
}): string | null {
  if (input.archivedAt || input.membershipStatus === "archived") {
    return "Archived staff cannot be invited.";
  }
  if (input.membershipStatus === "disabled") {
    return "Disabled staff cannot be invited.";
  }
  if (input.profileId) {
    return "Already has an active account.";
  }
  if (!input.email?.trim()) {
    return "Add an email address before sending an invitation.";
  }
  if (input.latestInvite) {
    const display = staffInvitationDisplayStatus(input.latestInvite);
    if (display === "pending") {
      return "An invitation is already pending.";
    }
  }
  if (input.membershipStatus !== "draft" && input.membershipStatus !== "ready") {
    return "Not eligible to invite.";
  }
  return null;
}
