import type { ReactNode } from "react";

import { isRole, roleLabels } from "@/config/roles";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStaffAssignedClassesSummary } from "@/features/admin/staff-directory/format-assigned-classes-summary";
import { formatStaffAssignedGradesSummary } from "@/features/admin/staff-directory/format-assigned-grades-summary";
import type {
  StaffClassAssignmentRow,
  StaffGradeAccessRow,
  StaffMemberRow,
} from "@/features/admin/staff-directory/staff-directory-queries";
import type { StaffLeadershipMetrics } from "@/features/staff-profile/load-staff-leadership-metrics";
import {
  formatAttendanceTodaySummary,
  formatProgressReportsOpsSummary,
  formatReportCardOpsSummary,
  formatTransitionOpsSummary,
} from "@/features/staff-profile/operations-summary";
import { personInitials } from "@/lib/people/person-initials";
import {
  staffRosterStatusKind,
  staffRosterStatusLabel,
} from "@/lib/staff/staff-roster-status";
import { cn } from "@/lib/utils";

type StaffProfileHeaderProps = {
  member: StaffMemberRow;
  grades: StaffGradeAccessRow[];
  classes: StaffClassAssignmentRow[];
  metrics: StaffLeadershipMetrics;
  actions?: ReactNode;
};

function MetaItem({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-foreground text-sm font-medium leading-snug">{children}</dd>
    </div>
  );
}

function OpsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground text-right text-sm font-medium leading-snug">
        {value}
      </dd>
    </div>
  );
}

export function StaffProfileHeader({
  member,
  grades,
  classes,
  metrics,
  actions,
}: StaffProfileHeaderProps) {
  const roleLabel = isRole(member.role) ? roleLabels[member.role] : member.role;
  const emailLabel = member.email?.trim() ? member.email : null;
  const showAssignment = member.role === "teacher";

  return (
    <header className="min-w-0 w-full">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between xl:gap-8">
        <div className="flex min-w-0 flex-1 gap-4 sm:gap-5">
          <Avatar className="border-border/80 size-14 shrink-0 border shadow-sm sm:size-16">
            <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold sm:text-lg">
              {personInitials(member.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-2">
              <div className="space-y-1">
                <p className="ns-eyebrow">Staff profile</p>
                <h1 className="text-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-tight">
                  {member.full_name}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-foreground text-sm font-medium">{roleLabel}</span>
                <StatusBadge
                  status={staffRosterStatusKind(member.displayStatus)}
                  label={staffRosterStatusLabel(member.displayStatus)}
                />
              </div>
            </div>

            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetaItem label="Email" className="sm:col-span-2 lg:col-span-1">
                {emailLabel ?? (
                  <span className="text-muted-foreground italic">Not added</span>
                )}
              </MetaItem>
              {showAssignment ? (
                <>
                  <MetaItem label="Grade / program">
                    {formatStaffAssignedGradesSummary(grades)}
                  </MetaItem>
                  <MetaItem label="Classes" className="sm:col-span-2 lg:col-span-1">
                    {formatStaffAssignedClassesSummary(classes)}
                  </MetaItem>
                </>
              ) : null}
            </dl>
          </div>
        </div>

        <aside className="border-border/70 flex w-full shrink-0 flex-col gap-4 border-t pt-4 xl:w-[min(100%,18rem)] xl:border-t-0 xl:border-l xl:pl-8 xl:pt-0">
          <div className="space-y-3">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Operations
            </p>
            <dl className="space-y-2">
              <OpsRow
                label="Attendance today"
                value={formatAttendanceTodaySummary(metrics.attendanceCompliance)}
              />
              <OpsRow
                label="Transition notes"
                value={formatTransitionOpsSummary(metrics)}
              />
              <OpsRow
                label="Report cards"
                value={formatReportCardOpsSummary(metrics.reportCards)}
              />
              <OpsRow
                label="Progress reports"
                value={formatProgressReportsOpsSummary()}
              />
            </dl>
          </div>
          {actions ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:flex-col">
              {actions}
            </div>
          ) : null}
        </aside>
      </div>
    </header>
  );
}
