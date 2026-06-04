import Link from "next/link";
import { CalendarDays, HeartHandshake } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Role } from "@/config/roles";
import {
  loadSchoolYearTermContext,
  loadSupportFlagsForStudent,
} from "@/features/attendance-behavior/load-support-flag-data";
import { computeAcademicFlags } from "@/features/interventions/academic-flags";
import { mergeSupportFlags } from "@/features/interventions/support-flags";
import {
  formatInterventionDate,
  formatInterventionUpdatedAt,
} from "@/features/interventions/format-intervention-date";
import {
  AcademicFlagsList,
  FollowUpTimelineStatusText,
  InterventionSeverityBadge,
  InterventionStatusBadge,
  InterventionTypeBadge,
} from "@/features/interventions/intervention-badges";
import { InterventionsProfileToolbar } from "@/features/interventions/interventions-profile-toolbar";
import { loadStudentInterventions } from "@/features/interventions/load-student-interventions";
import type { InterventionStatus } from "@/features/interventions/schema";
import type { StudentInterventionRow } from "@/features/interventions/types";
import { cn } from "@/lib/utils";

import { loadStudentIntelligence } from "../load-student-intelligence";
import { ProfileEmptyState } from "../profile-empty-state";
import {
  loadStudentProfileResult,
  teacherCanAccessStudentForProfile,
} from "../supabase-profile-data";

const CARD_CHROME = "border-border/70 shadow-sm";

const ACTIVE_STATUSES = new Set<InterventionStatus>(["active", "monitoring", "escalated"]);

const timelineRailClassName: Record<InterventionStatus, string> = {
  active: "border-primary bg-primary",
  monitoring: "border-amber-500 bg-amber-500",
  escalated: "border-destructive bg-destructive",
  resolved: "border-muted-foreground/35 bg-muted-foreground/50",
};

type InterventionsTabProps = {
  studentId: string;
  role: Role;
};

function MetaField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <dt className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-foreground text-sm leading-snug">{children}</dd>
    </div>
  );
}

function InterventionTimelineItem({ row }: { row: StudentInterventionRow }) {
  const isActive = ACTIVE_STATUSES.has(row.status);
  const notes = row.description.trim();

  return (
    <li className="relative pl-6">
      <span
        className={cn(
          "border-background absolute top-3 left-0 size-2.5 -translate-x-1/2 rounded-full border-2",
          timelineRailClassName[row.status],
        )}
        aria-hidden
      />
      <article
        className={cn(
          "border-border/70 bg-card rounded-lg border p-4 shadow-sm",
          isActive && "ring-primary/15 ring-1",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base leading-snug font-semibold">{row.title}</h3>
            <p className="text-muted-foreground text-xs">
              Updated {formatInterventionUpdatedAt(row.updatedAt)}
              <span className="text-muted-foreground/70">
                {" "}
                · {formatInterventionDate(row.updatedAt)}
              </span>
            </p>
          </div>
          <InterventionStatusBadge status={row.status} />
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetaField label="Type">
            <InterventionTypeBadge type={row.interventionType} />
          </MetaField>
          <MetaField label="Severity">
            <InterventionSeverityBadge severity={row.severity} />
          </MetaField>
          <MetaField label="Status">
            <InterventionStatusBadge status={row.status} />
          </MetaField>
          <MetaField label="Follow-up">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
              <FollowUpTimelineStatusText followUpDate={row.followUpDate} />
            </span>
          </MetaField>
          <MetaField label="Created">
            {formatInterventionDate(row.createdAt)}
          </MetaField>
          <MetaField label="Updated">
            {formatInterventionUpdatedAt(row.updatedAt)}
            <span className="text-muted-foreground block text-xs font-normal">
              {formatInterventionDate(row.updatedAt)}
            </span>
          </MetaField>
        </dl>

        <div className="border-border/60 mt-4 border-t pt-3">
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
            Notes
          </p>
          {notes ? (
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{notes}</p>
          ) : (
            <p className="text-muted-foreground/80 mt-1.5 text-sm italic">No description provided.</p>
          )}
        </div>

        {row.createdByName ? (
          <p className="text-muted-foreground mt-3 text-xs">
            Logged by {row.createdByName}
          </p>
        ) : null}
      </article>
    </li>
  );
}

export async function InterventionsTab({ studentId, role }: InterventionsTabProps) {
  const [load, profileLoad, intel, canCompose, termCtx] = await Promise.all([
    loadStudentInterventions(studentId),
    loadStudentProfileResult(studentId),
    loadStudentIntelligence(studentId, { viewerRole: role }),
    role === "teacher" ? teacherCanAccessStudentForProfile(studentId) : Promise.resolve(false),
    loadSchoolYearTermContext(),
  ]);

  const dashboardHref = `/dashboard/${role}/interventions`;

  if (load.ok === false) {
    return (
      <Card className={CARD_CHROME}>
        <CardContent className="pt-6">
          <p className="text-destructive text-sm" role="alert">
            {load.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { interventions } = load;
  const timeline = [...interventions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const activeCount = interventions.filter((i) => ACTIVE_STATUSES.has(i.status)).length;

  const academicFlags =
    intel.kind === "ok"
      ? computeAcademicFlags({
          overallPercent: intel.data.readiness.overallPercent,
          missingAssignmentCount: intel.data.readiness.missingAssignmentCount,
        })
      : [];
  const supportFlags =
    intel.kind === "ok" && termCtx.ok
      ? await loadSupportFlagsForStudent({
          studentId,
          classId: intel.data.classId,
          schoolYearLabel: intel.data.schoolYearLabel,
          termStart: termCtx.termStart,
          termEnd: termCtx.termEnd,
        })
      : [];
  const flags = mergeSupportFlags(academicFlags, supportFlags);

  const studentName =
    profileLoad.kind === "ok" ? profileLoad.profile.fullName : "Student";
  const classId = intel.kind === "ok" ? intel.data.classId : null;
  const showAddIntervention = canCompose && classId !== null;

  return (
    <div className="space-y-5">
      <Card className={CARD_CHROME}>
        <CardHeader className="space-y-4 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Interventions</CardTitle>
              <CardDescription>
                Support plans, follow-ups, and intervention history for this learner.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {showAddIntervention ? (
                <InterventionsProfileToolbar
                  studentId={studentId}
                  classId={classId}
                  studentName={studentName}
                />
              ) : null}
              {role === "teacher" ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={dashboardHref}>Interventions dashboard</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {flags.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium">Academic flags</p>
              <AcademicFlagsList flags={flags} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className={CARD_CHROME}>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
          <div className="space-y-0.5">
            <CardTitle className="text-base">Timeline</CardTitle>
            <CardDescription>
              Newest updates first. Active and monitoring plans are highlighted.
            </CardDescription>
          </div>
          {activeCount > 0 ? (
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {activeCount} active
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <ProfileEmptyState
              icon={HeartHandshake}
              title="No interventions recorded yet."
              description={
                showAddIntervention
                  ? "Add a support plan when this learner needs follow-up, academic support, or family contact."
                  : "Intervention records for this learner will appear here once staff log support plans."
              }
            />
          ) : (
            <ol className="border-border/70 relative space-y-6 border-l-2 pl-0">
              {timeline.map((row) => (
                <InterventionTimelineItem key={row.id} row={row} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}