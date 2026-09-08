/**
 * Pure helpers for staff Auth invitation emails (send / resend / setup).
 * Kept free of server-only imports so unit tests can import them.
 */

export function isAuthUserAlreadyRegisteredError(message: string | undefined): boolean {
  const m = message?.trim() ?? "";
  if (!m) return false;
  return (
    /already\s+been\s+registered/i.test(m) ||
    /already\s+registered/i.test(m) ||
    /user\s+already\s+exists/i.test(m) ||
    /email_exists/i.test(m) ||
    /already\s+has\s+an\s+activated\s+account/i.test(m) ||
    /already\s+has\s+an\s+account/i.test(m)
  );
}

export function isAuthEmailRateLimitError(message: string | undefined): boolean {
  const m = message?.trim() ?? "";
  if (!m) return false;
  return (
    /rate\s*limit/i.test(m) ||
    /too\s+many\s+requests/i.test(m) ||
    /over_email_send_rate_limit/i.test(m) ||
    /email\s+rate\s+limit/i.test(m)
  );
}

/**
 * Admin-facing copy when Supabase could not send the Auth invite email.
 * Prefer specific rate-limit / config guidance over a generic failure.
 */
export function messageForStaffInviteEmailFailure(
  rawMessage: string | undefined,
  opts?: { forResend?: boolean },
): string {
  const trimmed = rawMessage?.trim() ?? "";
  if (isAuthEmailRateLimitError(trimmed)) {
    return "Invitation email could not be sent yet — Supabase is rate-limiting invite emails. Wait a minute and try again.";
  }
  if (/invalid api key/i.test(trimmed) || /not configured/i.test(trimmed)) {
    return "Email could not be sent (server configuration). Copy the invite link instead.";
  }
  if (isAuthUserAlreadyRegisteredError(trimmed)) {
    return "This account already exists. Send a setup link instead.";
  }
  if (opts?.forResend) {
    if (trimmed) {
      return `Invitation could not be resent: ${trimmed}`;
    }
    return "Invitation could not be resent. Try again in a moment, or copy the invite link.";
  }
  if (trimmed && /email/i.test(trimmed)) {
    return `Invitation saved. Email could not be sent — ${trimmed}`;
  }
  return "Invitation saved. Email could not be sent — copy the invite link to share it.";
}

/** Admin-facing copy when a password reset / setup link could not be sent. */
export function messageForStaffSetupLinkFailure(rawMessage: string | undefined): string {
  const trimmed = rawMessage?.trim() ?? "";
  if (isAuthEmailRateLimitError(trimmed)) {
    return "Setup link could not be sent yet — email is rate-limited. Wait a minute and try again.";
  }
  if (/invalid api key/i.test(trimmed) || /not configured/i.test(trimmed) || /missing email/i.test(trimmed)) {
    return "Setup link could not be sent (server configuration). Ask the person to use Forgot password on the sign-in page, or try again later.";
  }
  if (trimmed) {
    return `Setup link could not be sent. Try again in a moment.`;
  }
  return "Setup link could not be sent. Try again in a moment.";
}

/** Show a short “just sent” hint when `sent_at` is within the last two minutes. */
export function formatInviteSentHint(
  sentAt: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!sentAt) return null;
  const t = new Date(sentAt).getTime();
  if (Number.isNaN(t)) return null;
  const diff = nowMs - t;
  if (diff >= 0 && diff < 2 * 60 * 1000) return "Sent just now";
  return null;
}

export type StaffDirectoryAccessAction =
  | "edit"
  | "send_invite"
  | "resend_invite"
  | "send_setup_link"
  | "none";

/**
 * Directory / profile primary access action from roster + Auth confirmation state.
 * When Auth says the account is confirmed, never offer Resend invitation.
 */
export function resolveStaffDirectoryAccessAction(input: {
  profileId?: string | null;
  archivedAt?: string | null;
  membershipStatus?: string | null;
  displayStatus: string;
  email?: string | null;
  /** true = confirmed Auth user; false = unconfirmed; null/undefined = unknown */
  authEmailConfirmed?: boolean | null;
  canSendNewInvite?: boolean;
}): StaffDirectoryAccessAction {
  if (input.archivedAt || input.membershipStatus === "archived") return "none";
  if (input.membershipStatus === "disabled") return "none";
  if (input.displayStatus === "disabled" || input.displayStatus === "archived") {
    return "none";
  }
  if (input.profileId) return "none";

  const hasEmail = Boolean(input.email?.trim());
  if (!hasEmail) return "edit";

  if (input.authEmailConfirmed === true) {
    return "send_setup_link";
  }

  if (input.displayStatus === "invitation_sent" || input.displayStatus === "opened") {
    return "resend_invite";
  }

  if (input.displayStatus === "account_exists") {
    return "send_setup_link";
  }

  if (input.canSendNewInvite || input.displayStatus === "draft" || input.displayStatus === "ready") {
    return "send_invite";
  }

  return "none";
}

export function canResendStaffMemberInvitation(input: {
  profileId?: string | null;
  archivedAt?: string | null;
  membershipStatus?: string | null;
  displayStatus: string;
  email?: string | null;
  authEmailConfirmed?: boolean | null;
}): boolean {
  return resolveStaffDirectoryAccessAction(input) === "resend_invite";
}

/**
 * Inline Access Status “Send invitation” — Ready to invite only.
 * Draft may still be eligible via bulk/menu when readiness rules allow; the row
 * status cell only surfaces the action for ready rows.
 */
export function canSendStaffNewInvitation(input: {
  profileId?: string | null;
  archivedAt?: string | null;
  membershipStatus?: string | null;
  displayStatus: string;
  email?: string | null;
  authEmailConfirmed?: boolean | null;
  canSendNewInvite?: boolean;
}): boolean {
  if (input.displayStatus !== "ready") return false;
  return resolveStaffDirectoryAccessAction(input) === "send_invite";
}

export function canSendStaffSetupLink(input: {
  profileId?: string | null;
  archivedAt?: string | null;
  membershipStatus?: string | null;
  displayStatus: string;
  email?: string | null;
  authEmailConfirmed?: boolean | null;
}): boolean {
  return resolveStaffDirectoryAccessAction(input) === "send_setup_link";
}

/** Secondary action for ACTIVE linked accounts — password reset, not invitation. */
export function canSendActiveStaffPasswordReset(input: {
  profileId?: string | null;
  archivedAt?: string | null;
  membershipStatus?: string | null;
  displayStatus: string;
  email?: string | null;
}): boolean {
  if (input.archivedAt || input.membershipStatus === "archived") return false;
  if (input.membershipStatus === "disabled") return false;
  if (input.displayStatus === "disabled" || input.displayStatus === "archived") return false;
  if (!input.profileId) return false;
  if (!input.email?.trim()) return false;
  return input.displayStatus === "active";
}

export type StaffInviteStatusInlineControl =
  | {
      kind: "send_invite";
      label: string;
      disabled: boolean;
    }
  | {
      kind: "resend_invite";
      label: string;
      disabled: boolean;
    }
  | {
      kind: "send_setup_link";
      label: string;
      disabled: boolean;
    }
  | {
      kind: "send_password_reset";
      label: string;
      disabled: boolean;
    };

/**
 * Pure label/disabled contract for the Access Status inline text actions.
 * Used so unit tests can assert Ready→Send invitation, loading, and post-send gating
 * without mounting the table.
 */
export function resolveStaffInviteStatusInlineControls(input: {
  profileId?: string | null;
  archivedAt?: string | null;
  membershipStatus?: string | null;
  displayStatus: string;
  email?: string | null;
  authEmailConfirmed?: boolean | null;
  canSendNewInvite?: boolean;
  /** True while a send/resend/setup action is in flight for this row. */
  pending?: boolean;
}): StaffInviteStatusInlineControl[] {
  const pending = Boolean(input.pending);
  const controls: StaffInviteStatusInlineControl[] = [];

  if (canSendStaffSetupLink(input)) {
    controls.push({
      kind: "send_setup_link",
      label: pending ? "Sending…" : "Send setup link",
      disabled: pending,
    });
  }
  if (canSendActiveStaffPasswordReset(input)) {
    controls.push({
      kind: "send_password_reset",
      label: pending ? "Sending…" : "Send password reset",
      disabled: pending,
    });
  }
  if (canSendStaffNewInvitation(input)) {
    controls.push({
      kind: "send_invite",
      label: pending ? "Sending…" : "Send invitation",
      disabled: pending,
    });
  }
  if (canResendStaffMemberInvitation(input)) {
    controls.push({
      kind: "resend_invite",
      label: pending ? "Resending…" : "Resend invitation",
      disabled: pending,
    });
  }

  return controls;
}
