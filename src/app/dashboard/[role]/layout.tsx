import { assertDashboardRoleMatchesProfile } from "@/lib/auth/assert-dashboard-role";

export default async function DashboardRoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  await assertDashboardRoleMatchesProfile(role);

  return children;
}
