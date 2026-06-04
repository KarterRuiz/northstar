import type { CreateInterventionInput, InterventionStatus } from "./schema";
import type {
  InterventionsDashboardStudentRow,
  StudentInterventionRow,
} from "./types";

const ACTIVE_STATUSES = new Set<InterventionStatus>(["active", "monitoring", "escalated"]);

export function buildOptimisticIntervention(
  interventionId: string,
  studentId: string,
  classId: string,
  input: Omit<CreateInterventionInput, "studentId" | "classId">,
): StudentInterventionRow {
  const now = new Date().toISOString();
  return {
    id: interventionId,
    studentId,
    classId,
    schoolYearId: "",
    interventionType: input.interventionType,
    status: input.status,
    severity: input.severity,
    title: input.title.trim(),
    description: input.description.trim(),
    createdBy: "",
    createdByName: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: input.status === "resolved" ? now : null,
    followUpDate: input.followUpDate,
  };
}

export function applyCreatedIntervention(
  row: InterventionsDashboardStudentRow,
  intervention: StudentInterventionRow,
): InterventionsDashboardStudentRow {
  const isActive = ACTIVE_STATUSES.has(intervention.status);
  return {
    ...row,
    activeIntervention: isActive ? intervention : row.activeIntervention,
    interventionCount: row.interventionCount + 1,
    lastUpdate: intervention.updatedAt,
    status: isActive ? intervention.status : row.status,
  };
}

export function applyResolvedIntervention(
  row: InterventionsDashboardStudentRow,
): InterventionsDashboardStudentRow {
  const now = new Date().toISOString();
  return {
    ...row,
    activeIntervention: null,
    status: "resolved",
    lastUpdate: now,
  };
}

export function applyEscalatedIntervention(
  row: InterventionsDashboardStudentRow,
): InterventionsDashboardStudentRow {
  const active = row.activeIntervention;
  if (!active) return row;
  const now = new Date().toISOString();
  const updated: StudentInterventionRow = {
    ...active,
    status: "escalated",
    updatedAt: now,
  };
  return {
    ...row,
    activeIntervention: updated,
    status: "escalated",
    lastUpdate: now,
  };
}
