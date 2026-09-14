import "server-only";

import { notFound, redirect } from "next/navigation";

import {
  canManageSchoolStructure,
  roleDashboardHref,
  type Role,
} from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";

export async function assertYearEndDashboardRole(roleFromUrl: Role): Promise<{
  userId: string;
  role: Role;
}> {
  if (!canManageSchoolStructure(roleFromUrl)) {
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
    if (canManageSchoolStructure(profileRole)) {
      redirect(`${roleDashboardHref(profileRole)}/year-end`);
    }
    notFound();
  }

  return { userId: user.id, role: profileRole };
}
