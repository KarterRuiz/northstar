import type { InterventionStatus } from "./schema";
import {
  hasAcademicRisk,
  hasMissingWorkAlert,
} from "./academic-flags";
import { isFollowUpActionable } from "./follow-up-status";
import {
  hasAttendanceConcern,
  hasBehaviorConcern,
  hasPositiveRecognition,
} from "./support-flags";
import type { InterventionsDashboardStudentRow } from "./types";

export const INTERVENTION_DASHBOARD_FILTERS = [
  "needs-attention",
  "missing-work",
  "academic-risk",
  "attendance-concern",
  "behavior-concern",
  "positive-recognition",
  "follow-ups-due",
] as const;

export type InterventionDashboardFilter =
  (typeof INTERVENTION_DASHBOARD_FILTERS)[number];

export const interventionDashboardFilterLabels: Record<
  InterventionDashboardFilter,
  string
> = {
  "needs-attention": "Students needing attention",
  "missing-work": "Missing work alerts",
  "academic-risk": "Academic risk alerts",
  "attendance-concern": "Attendance concerns",
  "behavior-concern": "Support concerns",
  "positive-recognition": "Positive recognition",
  "follow-ups-due": "Follow-ups due",
};

const ACTIVE_STATUSES = new Set<InterventionStatus>([
  "active",
  "monitoring",
  "escalated",
]);

export function isInterventionDashboardFilter(
  value: string | null | undefined,
): value is InterventionDashboardFilter {
  return (
    value != null &&
    (INTERVENTION_DASHBOARD_FILTERS as readonly string[]).includes(value)
  );
}

export function rowMatchesInterventionDashboardFilter(
  row: InterventionsDashboardStudentRow,
  filter: InterventionDashboardFilter,
): boolean {
  switch (filter) {
    case "needs-attention":
      return (
        hasAcademicRisk(row.flags) ||
        hasMissingWorkAlert(row.flags) ||
        hasAttendanceConcern(row.flags) ||
        hasBehaviorConcern(row.flags) ||
        (row.activeIntervention != null &&
          ACTIVE_STATUSES.has(row.activeIntervention.status))
      );
    case "missing-work":
      return hasMissingWorkAlert(row.flags);
    case "academic-risk":
      return hasAcademicRisk(row.flags);
    case "attendance-concern":
      return hasAttendanceConcern(row.flags);
    case "behavior-concern":
      return hasBehaviorConcern(row.flags);
    case "positive-recognition":
      return hasPositiveRecognition(row.flags);
    case "follow-ups-due":
      return (
        row.activeIntervention != null &&
        ACTIVE_STATUSES.has(row.activeIntervention.status) &&
        isFollowUpActionable(row.activeIntervention.followUpDate)
      );
  }
}

export function countInterventionDashboardFilter(
  rows: InterventionsDashboardStudentRow[],
  filter: InterventionDashboardFilter,
): number {
  return rows.filter((row) => rowMatchesInterventionDashboardFilter(row, filter))
    .length;
}
