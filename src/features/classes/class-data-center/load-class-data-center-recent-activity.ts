import "server-only";

import { cache } from "react";

import type { Role } from "@/config/roles";
import type { AuditAction } from "@/lib/audit/types";
import { canManageStudents } from "@/config/roles";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

const CLASS_ACTIVITY_ACTIONS = [
  "class_updated",
  "class_archived",
  "class_restored",
  "teacher_assigned",
  "gradebook_assignment_created",
  "gradebook_assignment_updated",
  "gradebook_assignment_deleted",
  "gradebook_scores_updated",
  "transition_note_submitted",
  "transition_note_reviewed",
  "report_card_uploaded",
  "report_card_generated",
  "intervention_created",
  "intervention_updated",
  "intervention_resolved",
] as const satisfies readonly AuditAction[];

export type ClassDataCenterActivityItem = {
  id: string;
  summary: string;
  occurredAt: string;
};

function asRecord(metadata: Json): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function describeClassActivity(action: string): string {
  switch (action) {
    case "class_updated":
      return "Class details updated";
    case "class_archived":
      return "Class archived";
    case "class_restored":
      return "Class restored";
    case "teacher_assigned":
      return "Teachers updated";
    case "gradebook_assignment_created":
      return "Assignment added";
    case "gradebook_assignment_updated":
      return "Assignment updated";
    case "gradebook_assignment_deleted":
      return "Assignment removed";
    case "gradebook_scores_updated":
      return "Scores updated";
    case "transition_note_submitted":
      return "Transition note submitted";
    case "transition_note_reviewed":
      return "Transition note reviewed";
    case "report_card_uploaded":
      return "Report card uploaded";
    case "report_card_generated":
      return "Report card generated";
    case "intervention_created":
      return "Support note added";
    case "intervention_updated":
      return "Support note updated";
    case "intervention_resolved":
      return "Support note resolved";
    default:
      return "Class activity";
  }
}

/**
 * Compact class-scoped recent activity. Read-only; does not write audit events.
 */
export const loadClassDataCenterRecentActivity = cache(
  async (classId: string, role: Role): Promise<ClassDataCenterActivityItem[]> => {
    if (!canManageStudents(role)) return [];
    if (!isSupabaseConfigured()) return [];

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("audit_events")
      .select("id, action, metadata, created_at")
      .in("action", [...CLASS_ACTIVITY_ACTIONS])
      .contains("metadata", { classId } as Record<string, unknown>)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error || !data) return [];

    return data.map((row) => {
      void asRecord(row.metadata);
      return {
        id: row.id,
        summary: describeClassActivity(row.action),
        occurredAt: row.created_at,
      };
    });
  },
);
