import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import { CalendarWorkspace } from "@/features/calendar/calendar-workspace";
import { loadCalendarWorkspace } from "@/features/calendar/load-calendar-workspace";
import { assertCalendarDashboardRole } from "@/features/calendar/require-calendar-actor";

export const metadata: Metadata = {
  title: "Calendar",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CalendarPage({ params, searchParams }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;

  await assertCalendarDashboardRole(role);

  const raw = await searchParams;
  const data = await loadCalendarWorkspace(role, raw);

  return <CalendarWorkspace role={role} data={data} />;
}
