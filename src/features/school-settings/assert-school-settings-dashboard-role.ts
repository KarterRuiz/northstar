import "server-only";

import { notFound, redirect } from "next/navigation";

import {
  canEditSchoolSettings,
  canViewSchoolSettings,
  roleDashboardHref,
  type Role,
} from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";

export async function assertSchoolSettingsDashboardRole(
  roleFromUrl: Role,
): Promise<void> {
  if (!canViewSchoolSettings(roleFromUrl)) {
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
    const section = canViewSchoolSettings(profileRole) ? "school-settings" : "";
    redirect(
      section
        ? `${roleDashboardHref(profileRole)}/${section}`
        : roleDashboardHref(profileRole),
    );
  }
}

export function schoolSettingsReadOnlyForRole(role: Role): boolean {
  return !canEditSchoolSettings(role);
}
