import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import { FollowUpWorkspace } from "@/features/follow-up/follow-up-workspace";
import { loadFollowUpWorkspace } from "@/features/follow-up/load-follow-up-workspace";
import { assertFollowUpDashboardRole } from "@/features/follow-up/require-follow-up-actor";

export const metadata: Metadata = {
  title: "Follow-Up",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FollowUpPage({ params, searchParams }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;

  await assertFollowUpDashboardRole(role);

  const raw = await searchParams;
  const data = await loadFollowUpWorkspace(role, raw);

  return <FollowUpWorkspace role={role} data={data} />;
}
