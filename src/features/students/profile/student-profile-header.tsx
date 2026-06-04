import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

import type { StudentProfile } from "./types";

type StudentProfileHeaderProps = {
  profile: StudentProfile;
  /** Label for the signed-in role (e.g. “Teacher”). */
  viewerRoleLabel: string;
  /** Student id from the URL (Supabase row id). */
  routeStudentId: string;
  /** Short system note shown under the meta row (storage / links, etc.). */
  hubHint?: string;
  actions?: ReactNode;
};

export function StudentProfileHeader({
  profile,
  viewerRoleLabel,
  routeStudentId,
  hubHint,
  actions,
}: StudentProfileHeaderProps) {
  return (
    <header className="min-w-0 flex-1 space-y-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-4">
          <div className="space-y-1">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
              Student record
            </p>
            <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
              {profile.fullName}
            </h1>
            <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
              Student intelligence center — grades, notes, report cards, and readiness in
              one workspace.
            </p>
          </div>

          <dl className="text-muted-foreground grid max-w-2xl gap-x-6 gap-y-3 text-xs sm:grid-cols-2 sm:text-sm">
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-muted-foreground font-medium tracking-wide uppercase">
                Record ID
              </dt>
              <dd>
                <code className="text-foreground bg-muted/80 block rounded-md px-2 py-1.5 font-mono text-[11px] leading-relaxed break-all sm:text-xs">
                  {routeStudentId}
                </code>
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground font-medium tracking-wide uppercase">
                Student number
              </dt>
              <dd className="text-foreground font-medium tabular-nums">
                {profile.studentNumber}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground font-medium tracking-wide uppercase">
                Grade &amp; class
              </dt>
              <dd className="text-foreground font-medium">
                {profile.gradeLevel}
                <span className="text-muted-foreground font-normal"> · </span>
                {profile.homeroom}
              </dd>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-muted-foreground font-medium tracking-wide uppercase">
                Session
              </dt>
              <dd className="text-foreground/90">Viewing as {viewerRoleLabel}</dd>
            </div>
          </dl>

          {hubHint ? (
            <p className="text-muted-foreground max-w-2xl border-border/60 border-l-2 pl-3 text-xs leading-relaxed">
              {hubHint}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-start lg:flex-col lg:items-end">
          <div
            className="flex flex-wrap gap-2 lg:justify-end"
            aria-label="Student status badges"
          >
            <Badge className="capitalize">{profile.division}</Badge>
            <Badge variant="secondary" className="capitalize">
              {profile.status}
            </Badge>
          </div>
          {actions ? <div className="flex w-full sm:w-auto">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}
