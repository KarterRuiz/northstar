import "server-only";

import { notFound, redirect } from "next/navigation";

import {
  dashboardSwitcherRoles,
  isRole,
  roleDashboardHref,
  type Role,
} from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";

/**
 * Ensures the URL dashboard segment matches the signed-in user's `profiles.role`.
 * Redirects to the user's workspace when they open another role's URL.
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
