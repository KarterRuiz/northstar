import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  isAuthEmailRateLimitError,
  messageForStaffSetupLinkFailure,
} from "@/lib/staff/staff-invite-email";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type SendStaffAuthSetupLinkResult = {
  emailSent: boolean;
  errorMessage?: string;
};

/**
 * Sends a password reset / sign-in setup email for an existing confirmed Auth user.
 * `redirectTo` must be the canonical setup-password callback
 * (`getAuthEmailRedirectToSetupPassword`). Does not call inviteUserByEmail.
 */
export async function sendStaffAuthSetupLink(args: {
  email: string;
  /** Absolute `/auth/callback?next=/auth/setup-password` (must be allowlisted). */
  redirectTo: string;
}): Promise<SendStaffAuthSetupLinkResult> {
  const email = normalizeEmail(args.email);
  if (!email) {
    return { emailSent: false, errorMessage: messageForStaffSetupLinkFailure("Missing email.") };
  }

  let adminClient: ReturnType<typeof createAdminSupabaseClient>;
  try {
    adminClient = createAdminSupabaseClient();
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[staff-setup] No admin client:", e);
    }
    return {
      emailSent: false,
      errorMessage: messageForStaffSetupLinkFailure("Email is not configured on the server."),
    };
  }

  const { error } = await adminClient.auth.resetPasswordForEmail(email, {
    redirectTo: args.redirectTo,
  });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[staff-setup] resetPasswordForEmail:", error.message);
    }
    if (isAuthEmailRateLimitError(error.message)) {
      return {
        emailSent: false,
        errorMessage: messageForStaffSetupLinkFailure(error.message),
      };
    }
    return {
      emailSent: false,
      errorMessage: messageForStaffSetupLinkFailure(error.message),
    };
  }

  return { emailSent: true };
}
