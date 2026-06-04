import type { ReactNode } from "react";
import {
  AlertCircle,
  ClipboardList,
  FileText,
  GraduationCap,
  HeartHandshake,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Role } from "@/config/roles";
import { formatOverallGrade } from "@/features/teacher/gradebook/calculations";
import {
  reportReadinessStatusLabel,
  transitionNoteStatusLabel,
  type ReportReadinessStatus,
  type TransitionNoteStatus,
} from "@/features/teacher/gradebook/report-readiness";

import {
  loadSchoolYearTermContext,
  loadSupportFlagsForStudent,
} from "@/features/attendance-behavior/load-support-flag-data";
import { computeAcademicFlags } from "@/features/interventions/academic-flags";
import { AcademicFlagsList } from "@/features/interventions/intervention-badges";
import { loadStudentInterventions } from "@/features/interventions/load-student-interventions";
import { mergeSupportFlags } from "@/features/interventions/support-flags";

import { loadStudentIntelligence } from "./load-student-intelligence";

const CARD_CHROME = "border-border/70 shadow-sm";

type StudentProfileIndicatorsProps = {
  studentId: string;
  role: Role;
};

function readinessVariant(
  status: ReportReadinessStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ready") return "default";
  if (status === "needs_grades") return "destructive";
  if (status === "missing_transition_note") return "secondary";
  return "outline";
}

function transitionVariant(
  status: TransitionNoteStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "submitted") return "default";
  if (status === "draft") return "secondary";
  return "destructive";
}

export async function StudentProfileIndicators({
  studentId,
  role,
}: StudentProfileIndicatorsProps) {
  const [intel, interventionsLoad, termCtx] = await Promise.all([
    loadStudentIntelligence(studentId, { viewerRole: role }),
    loadStudentInterventions(studentId),
    loadSchoolYearTermContext(),
  ]);
  const base = `/dashboard/${role}/students/${studentId}`;
  const activeInterventionCount =
    interventionsLoad.ok === true
      ? interventionsLoad.interventions.filter((i) =>
          ["active", "monitoring", "escalated"].includes(i.status),
        ).length
      : 0;

  if (intel.kind === "unconfigured" || intel.kind === "error") {
    return null;
  }

  if (intel.kind === "no_enrollment") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <IndicatorCard
          icon={GraduationCap}
          title="Running grade"
          value="—"
          hint="No active class enrollment"
        />
        <IndicatorCard
          icon={AlertCircle}
          title="Missing work"
          value="—"
          hint="Enroll in a class to track assignments"
        />
        <IndicatorCard
          icon={ClipboardList}
          title="Transition note"
          value="—"
          href={`${base}/transition-notes`}
        />
        <IndicatorCard
          icon={FileText}
          title="Report readiness"
          value="—"
          href={`${base}/report-cards`}
        />
      </div>
    );
  }

  const { readiness, className, classSubtitle, classId, schoolYearLabel } = intel.data;
  const academicFlags = computeAcademicFlags({
    overallPercent: readiness.overallPercent,
    missingAssignmentCount: readiness.missingAssignmentCount,
  });
  const supportFlags =
    termCtx.ok === true
      ? await loadSupportFlagsForStudent({
          studentId,
          classId,
          schoolYearLabel,
          termStart: termCtx.termStart,
          termEnd: termCtx.termEnd,
        })
      : [];
  const flags = mergeSupportFlags(academicFlags, supportFlags);
  const runningGrade =
    readiness.overallPercent !== null
      ? formatOverallGrade({
          percent: readiness.overallPercent,
          letter: readiness.overallLetter,
          isPartial: readiness.isPartialGrade,
        })
      : "—";

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs leading-relaxed">
        Class context:{" "}
        <span className="text-foreground font-medium">{className}</span>
        {classSubtitle ? (
          <>
            <span className="text-muted-foreground"> · </span>
            {classSubtitle}
          </>
        ) : null}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <IndicatorCard
          icon={GraduationCap}
          title="Running grade"
          value={runningGrade}
          hint={
            readiness.isPartialGrade
              ? "Partial — not all categories scored"
              : "From gradebook weights"
          }
          href={`${base}/grades`}
        />
        <IndicatorCard
          icon={AlertCircle}
          title="Missing assignments"
          value={String(readiness.missingAssignmentCount)}
          hint={
            readiness.missingAssignmentCount > 0
              ? "Needs scores or marked missing"
              : "All in-scope assignments entered"
          }
          href={`${base}/grades`}
          valueClassName={
            readiness.missingAssignmentCount > 0 ? "text-destructive" : undefined
          }
        />
        <IndicatorCard
          icon={ClipboardList}
          title="Transition note"
          value={
            <Badge variant={transitionVariant(readiness.transitionNoteStatus)}>
              {transitionNoteStatusLabel[readiness.transitionNoteStatus]}
            </Badge>
          }
          href={`${base}/transition-notes`}
        />
        <IndicatorCard
          icon={FileText}
          title="Report readiness"
          value={
            <Badge variant={readinessVariant(readiness.status)}>
              {reportReadinessStatusLabel[readiness.status]}
            </Badge>
          }
          hint={
            readiness.missingReportCardTerms.length > 0
              ? `Missing PDF: ${readiness.missingReportCardTerms.join(", ")}`
              : undefined
          }
          href={`${base}/report-cards`}
        />
        <IndicatorCard
          icon={HeartHandshake}
          title="Interventions"
          value={String(activeInterventionCount)}
          hint={
            activeInterventionCount > 0
              ? "Active or monitoring supports"
              : "No open interventions"
          }
          href={`${base}/interventions`}
        />
      </div>
      {flags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">Support flags</span>
          <AcademicFlagsList flags={flags} />
        </div>
      ) : null}
    </div>
  );
}

function IndicatorCard({
  icon: Icon,
  title,
  value,
  hint,
  href,
  valueClassName,
}: {
  icon: typeof GraduationCap;
  title: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  valueClassName?: string;
}) {
  const inner = (
    <Card className={`${CARD_CHROME} h-full transition-shadow hover:shadow-md`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-xs font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </CardHeader>
      <CardContent className="space-y-1">
        <div className={`text-lg font-semibold tabular-nums ${valueClassName ?? ""}`}>
          {value}
        </div>
        {hint ? (
          <CardDescription className="text-[11px] leading-snug">{hint}</CardDescription>
        ) : null}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}
