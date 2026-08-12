"use server";

import { roleDashboardHref } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { validateNorthStarPassword } from "@/lib/auth/password-policy";
import { getProfileRole } from "@/lib/auth/session";
import { syncStaffAccountAfterPasswordSetup } from "@/lib/staff/sync-staff-after-password-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SetupPasswordState =
  | { ok: false; error: string; deactivated?: boolean; noRole?: boolean }
  | { ok: true; next: string };

export async function completePasswordSetupAction(
  _prev: SetupPasswordState | undefined,
  formData: FormData,
): Promise<SetupPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const validation = validateNorthStarPassword(password, confirm);
  if (!validation.ok) {
    return { ok: false, error: validation.message };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      error: "This setup link is no longer valid.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    const message = updateError.message?.trim() || "Could not save your password. Try again.";
    if (/same password|should be different/i.test(message)) {
      return { ok: false, error: "Choose a password that is different from your current one." };
    }
    if (/at least|too short|weak|characters/i.test(message)) {
      return { ok: false, error: message };
    }
    return { ok: false, error: "Could not save your password. Try again." };
  }

  await syncStaffAccountAfterPasswordSetup();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_active === false) {
    await supabase.auth.signOut();
    return {
      ok: false,
      deactivated: true,
      error:
        "This account has been deactivated. Contact your school administrator if you need access restored.",
    };
  }

  await recordAuditEvent({
    action: "password_setup_completed",
    actorUserId: user.id,
    metadata: {
      email: user.email ?? "",
      authUserId: user.id,
    },
  });

  const role = await getProfileRole(user.id);
  if (!role) {
    return {
      ok: false,
      noRole: true,
      error:
        "Your password is saved, but a school role has not been assigned yet. Contact your administrator.",
    };
  }

  return { ok: true, next: roleDashboardHref(role) };
}
