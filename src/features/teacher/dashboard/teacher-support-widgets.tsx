import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import {
  INTERVENTION_DASHBOARD_FILTERS,
  interventionDashboardFilterLabels,
  type InterventionDashboardFilter,
} from "@/features/interventions/intervention-dashboard-filters";
import { loadTeacherInterventionWidgetMetrics } from "@/features/interventions/load-interventions-dashboard-data";
import { cn } from "@/lib/utils";

const BASE = "/dashboard/teacher";

const ATTENDANCE_BEHAVIOR_FILTERS: InterventionDashboardFilter[] = [
  "attendance-concern",
  "behavior-concern",
  "positive-recognition",
  "follow-ups-due",
];

const WIDGET_DESCRIPTIONS: Record<InterventionDashboardFilter, string> = {
  "needs-attention": "Academic, attendance, or support flags; open interventions.",
  "missing-work": "More than two missing assignments.",
  "academic-risk": "Overall grade below 70%.",
  "attendance-concern": "3+ term absences, 5+ tardies, or 2+ absences in one week.",
  "behavior-concern": "2+ medium/high support concerns this term.",
  "positive-recognition": "Positive note in the last 30 days.",
  "follow-ups-due": "Overdue or due within 2 school days.",
};

export async function TeacherSupportWidgets() {
  const metrics = await loadTeacherInterventionWidgetMetrics();

  return (
    <>
      <section aria-labelledby="support-widgets-heading" className="space-y-4">
        <WorkspaceSectionHeader
          id="support-widgets-heading"
          eyebrow="Attendance & support"
          title="Daily support signals"
          description="Rule-based flags from attendance and support moments — no AI scoring."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`${BASE}/attendance`}>Attendance</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`${BASE}/behavior`}>Support board</Link>
              </Button>
            </div>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ATTENDANCE_BEHAVIOR_FILTERS.map((filter) => (
            <SupportMetricCard key={filter} filter={filter} count={metrics[filter]} />
          ))}
        </div>
      </section>

      <section aria-labelledby="interventions-widgets-heading" className="space-y-4">
        <WorkspaceSectionHeader
          id="interventions-widgets-heading"
          eyebrow="Interventions"
          title="Academic support workflow"
          description="Gradebook flags and intervention follow-ups."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href={`${BASE}/interventions`}>Open interventions</Link>
            </Button>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {INTERVENTION_DASHBOARD_FILTERS.filter(
            (f) => !ATTENDANCE_BEHAVIOR_FILTERS.includes(f),
          ).map((filter) => (
            <SupportMetricCard key={filter} filter={filter} count={metrics[filter]} />
          ))}
        </div>
      </section>
    </>
  );
}

function SupportMetricCard({
  filter,
  count,
}: {
  filter: InterventionDashboardFilter;
  count: number;
}) {
  const href =
    filter === "attendance-concern"
      ? `${BASE}/attendance?tab=concerns`
      : filter === "behavior-concern" || filter === "positive-recognition"
        ? `${BASE}/behavior`
        : `${BASE}/interventions?filter=${filter}`;

  const label = interventionDashboardFilterLabels[filter];

  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-xl outline-none",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2",
      )}
    >
      <Card
        className={cn(
          "border-border/70 h-full shadow-sm transition-colors",
          "hover:bg-muted/40 hover:border-border",
          "group-active:bg-muted/60",
        )}
      >
        <CardHeader className="space-y-2 pb-2">
          <CardTitle className="text-sm leading-snug font-medium">{label}</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            {WIDGET_DESCRIPTIONS[filter]}
          </CardDescription>
        </CardHeader>
        <p
          className="px-6 pb-5 text-3xl font-semibold tabular-nums tracking-tight"
          aria-label={`${count} ${label.toLowerCase()}`}
        >
          {count}
        </p>
      </Card>
    </Link>
  );
}
