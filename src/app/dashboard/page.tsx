import { redirect } from "next/navigation";

import { roleDashboardHref } from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";

export default async function DashboardHomePage() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const profileRole = await getProfileRole(user.id);
  if (!profileRole) {
    redirect("/login?error=profile");
  }

  redirect(roleDashboardHref(profileRole));
}
