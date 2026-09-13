import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import type { StudentShellMetrics } from "./load-student-shell-metrics";
import type { StudentProfile } from "./types";

function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  const a = parts[0]![0] ?? "";
  const b = parts[parts.length - 1]![0] ?? "";
  return `${a}${b}`.toUpperCase() || "?";
}

function enrollmentLabel(status: StudentProfile["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "leave":
      return "On leave";
    case "graduated":
      return "Graduated";
    case "inactive":
      return "Inactive";
    default:
      return status;
  }
}

type StudentProfileHeaderProps = {
  profile: StudentProfile;
  viewerRoleLabel: string;
  routeStudentId: string;
  hubHint?: string;
  actions?: ReactNode;
  /** Live metrics for the command-center strip; null when profile failed to load. */
  shellMetrics: StudentShellMetrics | null;
};

export function StudentProfileHeader({
  profile,
  viewerRoleLabel,
  routeStudentId,
  hubHint,
  actions,
  shellMetrics,
}: StudentProfileHeaderProps) {
  const attn =
    shellMetrics?.attendancePercent != null
      ? `${Math.round(shellMetrics.attendancePercent)}%`
      : "—";

  return (
    <header className="min-w-0 flex-1 space-y-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-4 sm:gap-5">
          <Avatar className="border-border/80 size-16 shrink-0 border-2 shadow-sm sm:size-20">
            <AvatarFallback className="bg-muted text-muted-foreground text-lg font-semibold sm:text-xl">
              {initialsFromName(profile.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-1">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
                School command center
              </p>
              <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                {profile.fullName}
              </h1>
              <p className="text-muted-foreground max-w-2xl text-xs leading-relaxed sm:text-sm">
                Attendance, academics, behavior, interventions, and family partnership in one
                workspace — tuned for a ten-second scan.
              </p>
            </div>

            <dl className="text-muted-foreground grid gap-x-5 gap-y-3 text-xs sm:grid-cols-2 sm:text-sm lg:max-w-3xl">
              <div className="space-y-1">
                <dt className="text-muted-foreground font-medium tracking-wide uppercase">
                  Student Number
                </dt>
                <dd className="text-foreground font-medium tabular-nums">
                  {profile.studentNumber}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground font-medium tracking-wide uppercase">
                  Grade
                </dt>
                <dd className="text-foreground font-medium">{profile.gradeLevel}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground font-medium tracking-wide uppercase">
                  Homeroom / class
                </dt>
                <dd className="text-foreground font-medium leading-snug">
                  {profile.homeroom}
                  {profile.homeroomConflict ? (
                    <span className="text-destructive mt-1 block text-xs font-normal normal-case">
                      Multiple active homerooms for this school year — resolve with
                      Transfer or withdraw extras.
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground font-medium tracking-wide uppercase">
                  Enrollment
                </dt>
                <dd>
                  <Badge variant="secondary" className="capitalize">
                    {enrollmentLabel(profile.status)}
                  </Badge>
                </dd>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-muted-foreground font-medium tracking-wide uppercase">
                  Northstar Record ID
                </dt>
                <dd>
                  <code className="text-muted-foreground bg-muted/40 block rounded-md px-2 py-1 font-mono text-[10px] leading-relaxed break-all sm:text-[11px]">
                    {routeStudentId}
                  </code>
                </dd>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-muted-foreground font-medium tracking-wide uppercase">
                  Session
                </dt>
                <dd className="text-foreground/90">Viewing as {viewerRoleLabel}</dd>
              </div>
            </dl>

            {shellMetrics ? (
              <>
                <Separator className="bg-border/60" />
                <div>
                  <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
                    Live signals
                  </p>
                  <dl className="grid gap-3 sm:grid-cols-3">
                    <div className="bg-muted/40 border-border/60 rounded-lg border px-3 py-2.5">
                      <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                        Attendance (term)
                      </dt>
                      <dd className="text-foreground text-lg font-semibold tabular-nums">{attn}</dd>
                    </div>
                    <div className="bg-muted/40 border-border/60 rounded-lg border px-3 py-2.5">
                      <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                        Academic average
                      </dt>
                      <dd className="text-foreground text-lg font-semibold tabular-nums">
                        {shellMetrics.academicAverageLabel}
                      </dd>
                    </div>
                    <div className="bg-muted/40 border-border/60 rounded-lg border px-3 py-2.5">
                      <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                        Behavior status
                      </dt>
                      <dd className="text-foreground text-sm font-semibold leading-snug">
                        {shellMetrics.behaviorStatusLabel}
                      </dd>
                    </div>
                  </dl>
                </div>
              </>
            ) : null}

            {hubHint ? (
              <p className="text-muted-foreground max-w-2xl border-border/60 border-l-2 pl-3 text-xs leading-relaxed">
                {hubHint}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-start lg:flex-col lg:items-end">
          <div
            className="flex flex-wrap gap-2 lg:justify-end"
            aria-label="Student program badges"
          >
            <Badge className="capitalize">{profile.division}</Badge>
          </div>
          {actions ? <div className="flex w-full sm:w-auto">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}
