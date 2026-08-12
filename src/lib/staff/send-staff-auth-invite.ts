import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  isAuthUserAlreadyRegisteredError,
  messageForStaffInviteEmailFailure,
} from "@/lib/staff/staff-invite-email";
import { resolveStaffAuthUser } from "@/lib/staff/resolve-staff-auth-user";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type SendStaffAuthInviteResult = {
  emailSent: boolean;
  errorMessage?: string;
  authUserId?: string;
  /** True when a confirmed Auth user already owns this email — do not invite again. */
  accountExists?: boolean;
};

/**
 * Sends a Supabase Auth invite email with the canonical production `redirectTo`.
 *
 * When the email was already invited (Auth user exists but unconfirmed), deletes
 * that unconfirmed Auth user and invites again so a fresh email is delivered —
 * without touching `staff_members` / profiles / assignments.
 *
 * When the Auth user is already confirmed, does not invite or delete — returns
 * `accountExists: true` so callers can send a setup/reset link instead.
 */
export async function sendStaffAuthInviteEmail(args: {
  email: string;
  /** Absolute `/auth/callback?next=/auth/setup-password` (must be allowlisted). */
  redirectTo: string;
  /** Prior Auth user id from `staff_invitations.accepted_user_id`, when known. */
  existingAuthUserId?: string | null;
  /** When true, failure messages are framed for resend (not first-time save). */
  forResend?: boolean;
}): Promise<SendStaffAuthInviteResult> {
  const email = normalizeEmail(args.email);
  let adminClient: ReturnType<typeof createAdminSupabaseClient>;
  try {
    adminClient = createAdminSupabaseClient();
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[staff-invite] No admin client:", e);
    }
    return {
      emailSent: false,
      errorMessage: messageForStaffInviteEmailFailure("Email is not configured on the server.", {
        forResend: args.forResend,
      }),
    };
  }

  const inviteOnce = async (): Promise<SendStaffAuthInviteResult> => {
    const { data: inviteAuth, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: args.redirectTo,
      });

    if (inviteError) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[staff-invite] inviteUserByEmail:", inviteError.message);
      }
      return { emailSent: false, errorMessage: inviteError.message };
    }

    const invitedUser = inviteAuth?.user;
    const authUserId =
      invitedUser?.id && normalizeEmail(invitedUser.email ?? "") === email
        ? invitedUser.id
        : undefined;

    return { emailSent: true, authUserId };
  };

  const first = await inviteOnce();
  if (first.emailSent) return first;

  if (!isAuthUserAlreadyRegisteredError(first.errorMessage)) {
    return {
      emailSent: false,
      errorMessage: messageForStaffInviteEmailFailure(first.errorMessage, {
        forResend: args.forResend,
      }),
    };
  }

  const resolved = await resolveStaffAuthUser({
    email,
    knownAuthUserId: args.existingAuthUserId ?? null,
    adminClient,
  });

  if (!resolved) {
    return {
      emailSent: false,
      errorMessage: messageForStaffInviteEmailFailure(first.errorMessage, {
        forResend: args.forResend,
      }),
    };
  }

  if (resolved.confirmed) {
    return {
      emailSent: false,
      accountExists: true,
      authUserId: resolved.userId,
      errorMessage: "This account already exists. Send a setup link instead.",
    };
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(resolved.userId);
  if (deleteError) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[staff-invite] deleteUser before re-invite:", deleteError.message);
    }
    return {
      emailSent: false,
      errorMessage: messageForStaffInviteEmailFailure(
        `Could not refresh the Auth invite (${deleteError.message})`,
        { forResend: args.forResend },
      ),
    };
  }

  const second = await inviteOnce();
  if (second.emailSent) return second;

  return {
    emailSent: false,
    errorMessage: messageForStaffInviteEmailFailure(second.errorMessage, {
      forResend: args.forResend,
    }),
  };
}
