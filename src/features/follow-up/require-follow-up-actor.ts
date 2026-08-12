import "server-only";

import { notFound, redirect } from "next/navigation";

import { canAccessFollowUp, roleDashboardHref, type Role } from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";

export { canAccessFollowUp };

export async function assertFollowUpDashboardRole(roleFromUrl: Role): Promise<{
  userId: string;
  role: Role;
}> {
  if (!canAccessFollowUp(roleFromUrl)) {
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
    if (canAccessFollowUp(profileRole)) {
      redirect(`${roleDashboardHref(profileRole)}/follow-up`);
    }
    notFound();
  }

  return { userId: user.id, role: profileRole };
}
