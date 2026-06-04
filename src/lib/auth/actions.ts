"use server";

import { redirect } from "next/navigation";

import { roleDashboardHref } from "@/config/roles";
import { getProfileRole } from "@/lib/auth/session";
import { syncPendingStaffInvitationProfile } from "@/lib/staff/sync-staff-invitation-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SignInState = { error: string | null };

export async function signInWithPassword(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { error: "Could not load user after sign-in." };
  }

  await syncPendingStaffInvitationProfile();

  const role = await getProfileRole(userData.user.id);
  if (!role) {
    await supabase.auth.signOut();
    redirect("/login?error=profile");
  }

  redirect(roleDashboardHref(role));
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
