import "server-only";

import { notFound, redirect } from "next/navigation";

import {
  dashboardSwitcherRoles,
  isRole,
  roleDashboardHref,
  type Role,
} from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Ensures the URL dashboard segment matches the signed-in user's `profiles.role`.
 * Redirects to the user's workspace when they open another role's URL.
 * Deactivated staff are signed out and sent to login.
 */
export async function assertDashboardRoleMatchesProfile(
  roleFromUrl: string,
): Promise<Role> {
  if (!isRole(roleFromUrl)) {
    notFound();
  }

  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && profile.is_active === false) {
    await supabase.auth.signOut();
    redirect("/login?error=deactivated");
  }

  const profileRole = await getProfileRole(user.id);
  if (!profileRole) {
    redirect("/login?error=profile");
  }

  if (profileRole !== roleFromUrl) {
    redirect(roleDashboardHref(profileRole));
  }

  return profileRole;
}

/** Loads profile role and switcher entries for dashboard chrome (sidebar). */
export async function getDashboardAccessContext(): Promise<{
  profileRole: Role | null;
  switcherRoles: readonly Role[];
}> {
  const user = await getUser();
  if (!user) {
    return { profileRole: null, switcherRoles: [] };
  }

  const profileRole = await getProfileRole(user.id);
  if (!profileRole) {
    return { profileRole: null, switcherRoles: [] };
  }

  return {
    profileRole,
    switcherRoles: dashboardSwitcherRoles(profileRole),
  };
}
