import Link from "next/link";
import { CalendarCheck } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import { loadAdminAttendanceOverviewMetrics } from "@/features/attendance/admin/load-admin-attendance-overview";

const linkClass =
  "text-primary text-sm font-medium underline-offset-4 transition-colors duration-150 hover:underline";

export async function AdminAttendanceOverview() {
  const metrics = await loadAdminAttendanceOverviewMetrics();

  const cards = [
    {
      title: "Absences today",
      value: metrics.absencesToday,
      href: "/dashboard/admin/attendance",
    },
    {
      title: "Classes missing attendance",
      value: metrics.classesNotSubmitted,
      href: "/dashboard/admin/attendance?status=missing",
    },
    {
      title: "Students needing follow-up",
      value: metrics.studentsNeedingFollowUp,
      href: "/dashboard/admin/attendance",
    },
  ] as const;

  return (
    <section aria-labelledby="admin-attendance-heading" className="space-y-4">
      <WorkspaceSectionHeader
        id="admin-attendance-heading"
        eyebrow="Attendance"
        title="Today's attendance signals"
        description="Operational counts from class attendance submissions."
        actions={
          <Link href="/dashboard/admin/attendance" className={linkClass}>
            Open attendance monitoring
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="group block rounded-xl">
            <Card className="border-border/70 h-full shadow-sm transition-colors hover:bg-muted/40">
              <CardHeader className="space-y-2 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <CalendarCheck className="text-muted-foreground size-4" aria-hidden />
                  {card.title}
                </CardTitle>
                <CardDescription className="text-xs">Tap to review</CardDescription>
              </CardHeader>
              <p className="px-6 pb-5 text-3xl font-semibold tabular-nums">{card.value}</p>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
