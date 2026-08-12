"use server";

import { isValidEmailFormat } from "@/lib/validation/is-valid-email-format";
import { getAuthEmailRedirectToSetupPassword } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ForgotPasswordState = {
  ok: boolean;
  message: string;
};

const GENERIC_SENT =
  "If an account exists for that email, we sent a NorthStar setup link. Check your inbox.";

export async function requestPasswordSetupLinkAction(
  _prev: ForgotPasswordState | undefined,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !isValidEmailFormat(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  let redirectTo: string;
  try {
    redirectTo = getAuthEmailRedirectToSetupPassword();
  } catch {
    return {
      ok: false,
      message: "Email is not configured on the server. Try again later or contact your administrator.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[forgot-password] resetPasswordForEmail:", error.message);
    }
    if (/rate.?limit/i.test(error.message)) {
      return {
        ok: false,
        message: "Too many requests. Wait a minute and try again.",
      };
    }
    // Still show a generic success to avoid email enumeration when the provider
    // rejects unknown addresses inconsistently.
    return { ok: true, message: GENERIC_SENT };
  }

  return { ok: true, message: GENERIC_SENT };
}
