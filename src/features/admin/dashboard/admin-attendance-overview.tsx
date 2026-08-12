import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import { loadAdminAttendanceOverviewMetrics } from "@/features/attendance/admin/load-admin-attendance-overview";

import {
  adminSignalBadgeVariant,
  attendanceSignalStatus,
} from "./admin-signal-status";

const linkClass =
  "text-primary text-sm font-medium underline-offset-4 transition-colors duration-150 hover:underline";

function plural(count: number, one: string, other: string): string {
  return count === 1 ? one : other;
}

export async function AdminAttendanceOverview() {
  const metrics = await loadAdminAttendanceOverviewMetrics();
  const isHealthy =
    metrics.classesNotSubmitted === 0 && metrics.studentsNeedingFollowUp === 0;
  const status = attendanceSignalStatus({
    classesNotSubmitted: metrics.classesNotSubmitted,
    studentsNeedingFollowUp: metrics.studentsNeedingFollowUp,
    hasClassesExpectingAttendance: metrics.hasClassesExpectingAttendance,
  });

  const summary = !metrics.hasClassesExpectingAttendance
    ? "No classes expecting attendance yet."
    : isHealthy
      ? "All class attendance is complete."
      : [
          metrics.classesNotSubmitted > 0
            ? `${metrics.classesNotSubmitted} ${plural(
                metrics.classesNotSubmitted,
                "class",
                "classes",
              )} missing today's submission`
            : null,
          metrics.studentsNeedingFollowUp > 0
            ? `${metrics.studentsNeedingFollowUp} ${plural(
                metrics.studentsNeedingFollowUp,
                "student",
                "students",
              )} needing follow-up`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  const metricsRow = [
    {
      label: "Absences today",
      value: metrics.absencesToday,
      href: "/dashboard/admin/attendance",
    },
    {
      label: "Classes missing",
      value: metrics.classesNotSubmitted,
      href: "/dashboard/admin/attendance?status=missing",
    },
    {
      label: "Follow-up",
      value: metrics.studentsNeedingFollowUp,
      href: "/dashboard/admin/attendance",
    },
  ] as const;

  return (
    <section aria-labelledby="admin-attendance-heading" className="space-y-3">
      <WorkspaceSectionHeader
        id="admin-attendance-heading"
        eyebrow="Attendance"
        title="Today's attendance"
        description={summary}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant={adminSignalBadgeVariant(status)}
              className="text-[11px] shadow-none"
            >
              {status}
            </Badge>
            <Link href="/dashboard/admin/attendance" className={linkClass}>
              Open attendance
            </Link>
          </div>
        }
      />

      {isHealthy && metrics.absencesToday === 0 ? (
        <div
          role="status"
          className="text-muted-foreground flex items-center gap-2.5 py-1"
        >
          <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
          <p className="ns-body">No absences recorded today.</p>
        </div>
      ) : (
        <Card variant="compact" className="overflow-hidden p-0">
          <div className="divide-border grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {metricsRow.map((row) => (
              <Link
                key={row.label}
                href={row.href}
                className="hover:bg-muted/40 focus-visible:ring-ring block px-4 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset"
              >
                <p className="text-muted-foreground text-xs font-medium">
                  {row.label}
                </p>
                <p className="text-foreground mt-1 text-xl font-semibold tracking-tight tabular-nums">
                  {row.value}
                </p>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </section>
  );
}
