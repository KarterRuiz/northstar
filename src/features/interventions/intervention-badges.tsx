import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { AcademicFlag } from "./academic-flags";
import {
  followUpTimelineLabel,
  getFollowUpTimelineStatus,
  type FollowUpDashboardStatus,
  type FollowUpTimelineStatus,
} from "./follow-up-status";
import {
  interventionSeverityLabels,
  interventionStatusLabels,
  interventionTypeLabels,
  type InterventionSeverity,
  type InterventionStatus,
  type InterventionType,
} from "./schema";

export function academicFlagClassName(kind: AcademicFlag["kind"]): string {
  if (kind === "academic_risk") {
    return "border-destructive/35 bg-destructive/5 text-destructive dark:text-destructive";
  }
  if (kind === "missing_work") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100";
  }
  if (kind === "attendance_concern") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100";
  }
  if (kind === "behavior_concern") {
    return "border-orange-500/40 bg-orange-500/10 text-orange-950 dark:text-orange-100";
  }
  if (kind === "positive_recognition") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
  }
  return "border-border/80 bg-muted/40 text-muted-foreground";
}

export function AcademicFlagBadge({ flag }: { flag: AcademicFlag }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap text-xs font-medium",
        academicFlagClassName(flag.kind),
      )}
    >
      {flag.label}
    </Badge>
  );
}

export function AcademicFlagsList({
  flags,
  className,
}: {
  flags: AcademicFlag[];
  className?: string;
}) {
  if (flags.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {flags.map((flag) => (
        <AcademicFlagBadge key={flag.kind} flag={flag} />
      ))}
    </div>
  );
}

const interventionStatusClassName: Record<InterventionStatus, string> = {
  active:
    "border-primary/35 bg-primary/12 text-primary shadow-none hover:bg-primary/12",
  monitoring:
    "border-amber-500/40 bg-amber-500/12 text-amber-950 shadow-none hover:bg-amber-500/12 dark:text-amber-100",
  resolved:
    "border-border bg-muted/60 text-muted-foreground shadow-none hover:bg-muted/60",
  escalated:
    "border-destructive/45 bg-destructive/12 text-destructive shadow-none hover:bg-destructive/12",
};

export function interventionStatusVariant(
  status: InterventionStatus | "none",
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "monitoring") return "secondary";
  if (status === "escalated") return "destructive";
  if (status === "resolved") return "outline";
  return "outline";
}

export function InterventionStatusBadge({
  status,
}: {
  status: InterventionStatus | "none";
}) {
  if (status === "none") {
    return (
      <Badge variant="outline" className="text-xs">
        None
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", interventionStatusClassName[status])}
    >
      {interventionStatusLabels[status]}
    </Badge>
  );
}

export function InterventionTypeBadge({ type }: { type: InterventionType }) {
  return (
    <Badge variant="outline" className="text-xs">
      {interventionTypeLabels[type]}
    </Badge>
  );
}

export function interventionSeverityClassName(severity: InterventionSeverity): string {
  if (severity === "high") {
    return "border-destructive/40 bg-destructive/10 text-destructive dark:text-destructive";
  }
  if (severity === "medium") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100";
  }
  return "border-border/80 bg-muted/40 text-muted-foreground";
}

export function InterventionSeverityBadge({ severity }: { severity: InterventionSeverity }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", interventionSeverityClassName(severity))}
    >
      {interventionSeverityLabels[severity]}
    </Badge>
  );
}

const followUpDashboardClassName: Record<
  Exclude<FollowUpDashboardStatus, "none" | "scheduled">,
  string
> = {
  due_soon:
    "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  overdue:
    "border-destructive/40 bg-destructive/10 text-destructive dark:text-destructive",
};

export function FollowUpDashboardBadge({
  status,
}: {
  status: FollowUpDashboardStatus;
}) {
  if (status === "none" || status === "scheduled") return null;

  const label = status === "due_soon" ? "Due soon" : "Overdue";
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", followUpDashboardClassName[status])}
    >
      {label}
    </Badge>
  );
}

const followUpTimelineClassName: Record<FollowUpTimelineStatus, string> = {
  none: "text-muted-foreground",
  scheduled: "text-foreground",
  overdue:
    "border-destructive/40 bg-destructive/10 text-destructive dark:text-destructive",
};

export function FollowUpTimelineStatusText({
  followUpDate,
}: {
  followUpDate: string | null;
}) {
  const status = getFollowUpTimelineStatus(followUpDate);
  const label = followUpTimelineLabel(followUpDate);

  if (status === "none") {
    return <span className={followUpTimelineClassName.none}>{label}</span>;
  }

  if (status === "overdue") {
    return (
      <Badge
        variant="outline"
        className={cn("text-xs font-medium", followUpTimelineClassName.overdue)}
      >
        {label}
      </Badge>
    );
  }

  return <span className={followUpTimelineClassName.scheduled}>{label}</span>;
}
