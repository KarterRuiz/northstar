import "server-only";

import { cache } from "react";

import type { AuditAction } from "@/lib/audit/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

/** Leadership-relevant audit actions with reliable timestamps (attendance is not audited). */
const LEADERSHIP_ACTIVITY_ACTIONS = [
  "transition_note_submitted",
  "transition_note_reviewed",
  "staff_invited",
  "staff_invitation_resent",
  "staff_invite_accepted",
  "password_setup_completed",
  "parent_request_created",
  "parent_request_updated",
  "parent_request_completed",
  "report_card_uploaded",
  "report_card_generated",
  "report_card_archived",
  "class_created",
  "teacher_assigned",
] as const satisfies readonly AuditAction[];

export type AdminRecentActivityItem = {
  id: string;
  summary: string;
  /** Display name when the actor profile is known. */
  actorLabel: string | null;
  href: string | null;
  occurredAt: string;
};

export type AdminRecentActivityResult = {
  items: AdminRecentActivityItem[];
  /** Soft flag only — never expose technical DB messages to the UI. */
  error: string | null;
};

function asRecord(metadata: Json): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function stringMeta(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function describeActivity(
  action: string,
  metadata: Json,
): { summary: string; href: string | null } {
  const meta = asRecord(metadata);
  const email = stringMeta(meta, "email");
  const fullName = stringMeta(meta, "fullName");

  switch (action) {
    case "transition_note_submitted":
      return {
        summary: "Transition note submitted for review",
        href: "/dashboard/admin/academic-review?tn=submitted",
      };
    case "transition_note_reviewed":
      return {
        summary: "Transition note marked reviewed",
        href: "/dashboard/admin/academic-review",
      };
    case "staff_invited":
      return {
        summary: fullName
          ? `Staff invitation sent to ${fullName}`
          : email
            ? `Staff invitation sent to ${email}`
            : "Staff invitation sent",
        href: "/dashboard/admin/teachers",
      };
    case "staff_invitation_resent":
      return {
        summary: fullName
          ? `Staff invitation resent to ${fullName}`
          : email
            ? `Staff invitation resent to ${email}`
            : "Staff invitation resent",
        href: "/dashboard/admin/teachers",
      };
    case "staff_invite_accepted":
      return {
        summary: email
          ? `${email} accepted a staff invitation`
          : "Staff invitation accepted",
        href: "/dashboard/admin/teachers",
      };
    case "password_setup_completed":
      return {
        summary: email
          ? `${email} finished NorthStar password setup`
          : "Staff password setup completed",
        href: "/dashboard/admin/teachers",
      };
    case "parent_request_created":
      return {
        summary: "Parent record request received",
        href: "/dashboard/admin/parent-requests",
      };
    case "parent_request_updated":
      return {
        summary: "Parent record request updated",
        href: "/dashboard/admin/parent-requests",
      };
    case "parent_request_completed":
      return {
        summary: "Parent record request completed",
        href: "/dashboard/admin/parent-requests",
      };
    case "report_card_uploaded":
      return {
        summary: "Report card uploaded",
        href: "/dashboard/admin/report-cards",
      };
    case "report_card_generated":
      return {
        summary: "Report card generated",
        href: "/dashboard/admin/report-cards",
      };
    case "report_card_archived":
      return {
        summary: "Report card archived",
        href: "/dashboard/admin/report-cards",
      };
    case "class_created":
      return {
        summary: "New class created",
        href: "/dashboard/admin/classes",
      };
    case "teacher_assigned":
      return {
        summary: "Teacher assigned to a class",
        href: "/dashboard/admin/classes",
      };
    default:
      return { summary: "School activity recorded", href: null };
  }
}

/**
 * Recent leadership activity from `audit_events`.
 * Skips when empty; does not invent sample rows. Attendance submissions are not in the audit stream.
 */
export const loadAdminRecentActivity = cache(
  async (): Promise<AdminRecentActivityResult> => {
    if (!isSupabaseConfigured()) {
      return { items: [], error: null };
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("audit_events")
      .select("id, action, actor_id, metadata, created_at")
      .in("action", [...LEADERSHIP_ACTIVITY_ACTIONS])
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      return { items: [], error: "unavailable" };
    }

    const rows = data ?? [];
    const actorIds = [
      ...new Set(
        rows
          .map((row) => row.actor_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];

    const actorNameById = new Map<string, string>();
    if (actorIds.length > 0) {
      const profilesRes = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds);
      for (const profile of profilesRes.data ?? []) {
        const label =
          profile.full_name?.trim() || profile.email?.trim() || null;
        if (label) actorNameById.set(profile.id, label);
      }
    }

    const items: AdminRecentActivityItem[] = rows.map((row) => {
      const described = describeActivity(row.action, row.metadata);
      return {
        id: row.id,
        summary: described.summary,
        actorLabel: row.actor_id
          ? (actorNameById.get(row.actor_id) ?? null)
          : null,
        href: described.href,
        occurredAt: row.created_at,
      };
    });

    return { items, error: null };
  },
);
