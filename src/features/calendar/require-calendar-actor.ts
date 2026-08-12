import "server-only";

import { notFound, redirect } from "next/navigation";

import {
  canAccessCalendar,
  canViewCalendar,
  roleDashboardHref,
  type Role,
} from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";

export { canAccessCalendar, canViewCalendar };

export async function assertCalendarDashboardRole(roleFromUrl: Role): Promise<{
  userId: string;
  role: Role;
}> {
  if (!canViewCalendar(roleFromUrl)) {
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
    if (canViewCalendar(profileRole)) {
      redirect(`${roleDashboardHref(profileRole)}/calendar`);
    }
    notFound();
  }

  return { userId: user.id, role: profileRole };
}
