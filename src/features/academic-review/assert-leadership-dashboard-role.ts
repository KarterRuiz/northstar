import "server-only";

import { notFound, redirect } from "next/navigation";

import {
  isLeadershipAuditRole,
  roleDashboardHref,
  type Role,
} from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";

/**
 * Ensures the URL dashboard role is admin/principal/VP and matches the signed-in profile.
 * Prevents teachers/registrars from opening leadership-only academic review routes.
 */
export async function assertLeadershipDashboardRole(
  roleFromUrl: Role,
): Promise<void> {
  if (!isLeadershipAuditRole(roleFromUrl)) {
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
    redirect(`${roleDashboardHref(profileRole)}/academic-review`);
  }
}
