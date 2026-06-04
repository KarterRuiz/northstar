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

const WIDGET_DESCRIPTIONS: Record<InterventionDashboardFilter, string> = {
  "needs-attention": "Academic, attendance, or support flags; open interventions.",
  "missing-work": "More than two missing assignments.",
  "academic-risk": "Overall grade below 70%.",
  "attendance-concern": "3+ term absences, 5+ tardies, or 2+ absences in one week.",
  "behavior-concern": "2+ medium/high support concerns this term.",
  "positive-recognition": "Positive note in the last 30 days.",
  "follow-ups-due": "Overdue or due within 2 school days.",
};

export async function TeacherInterventionWidgets() {
  const metrics = await loadTeacherInterventionWidgetMetrics();

  return (
    <section aria-labelledby="interventions-widgets-heading" className="space-y-4">
      <WorkspaceSectionHeader
        id="interventions-widgets-heading"
        eyebrow="Interventions"
        title="Support workflow"
        description="Academic flags and intervention follow-ups from your gradebook and support plans."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`${BASE}/interventions`}>Open interventions</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {INTERVENTION_DASHBOARD_FILTERS.map((filter) => (
          <InterventionMetricCard
            key={filter}
            filter={filter}
            count={metrics[filter]}
          />
        ))}
      </div>
    </section>
  );
}

function InterventionMetricCard({
  filter,
  count,
}: {
  filter: InterventionDashboardFilter;
  count: number;
}) {
  const href = `${BASE}/interventions?filter=${filter}`;
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
