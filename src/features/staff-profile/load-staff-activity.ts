import "server-only";

import { cache } from "react";

import type { AuditAction } from "@/lib/audit/types";
import { isUuid } from "@/lib/students/uuid";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

/** Staff-scoped audit actions with reliable timestamps and staffMemberId metadata. */
const STAFF_ACTIVITY_ACTIONS = [
  "staff_profile_viewed",
  "staff_profile_updated",
  "staff_profile_deleted",
  "staff_invited",
  "staff_invite_accepted",
  "staff_profile_linked",
  "staff_grade_access_updated",
  "staff_attendance_recorded",
  "staff_attendance_corrected",
  "teacher_assigned",
  "role_updated",
  "profile_status_changed",
] as const satisfies readonly AuditAction[];

export type StaffActivityItem = {
  id: string;
  summary: string;
  actorLabel: string | null;
  occurredAt: string;
};

export type StaffActivityResult = {
  items: StaffActivityItem[];
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

function matchesStaffMember(
  metadata: Json,
  staffMemberId: string,
  profileId: string | null,
): boolean {
  const meta = asRecord(metadata);
  const byMember = stringMeta(meta, "staffMemberId");
  if (byMember === staffMemberId) return true;
  if (profileId) {
    const target = stringMeta(meta, "targetUserId");
    const accepted = stringMeta(meta, "acceptedUserId");
    const teacher = stringMeta(meta, "teacherProfileId");
    if (target === profileId || accepted === profileId || teacher === profileId) {
      return true;
    }
  }
  return false;
}

function describeStaffActivity(action: string, metadata: Json): string {
  const meta = asRecord(metadata);
  const status = stringMeta(meta, "status");
  const date = stringMeta(meta, "attendanceDate");

  switch (action) {
    case "staff_profile_viewed":
      return "Professional record viewed";
    case "staff_profile_updated":
      return stringMeta(meta, "changedSummary")
        ? `Profile updated (${stringMeta(meta, "changedSummary")})`
        : "Profile updated";
    case "staff_profile_deleted":
      return "Staff member removed from roster";
    case "staff_invited":
      return "Invitation sent";
    case "staff_invite_accepted":
      return "Invitation accepted";
    case "staff_profile_linked":
      return "Account linked to roster";
    case "staff_grade_access_updated":
      return "Grade access updated";
    case "staff_attendance_recorded":
      return date && status
        ? `Attendance recorded for ${date}: ${status.replaceAll("_", " ")}`
        : "Attendance recorded";
    case "staff_attendance_corrected":
      return date && status
        ? `Attendance corrected for ${date}: ${status.replaceAll("_", " ")}`
        : "Attendance corrected";
    case "teacher_assigned":
      return "Class assignment changed";
    case "role_updated":
      return "Role updated";
    case "profile_status_changed":
      return "Account access status changed";
    default:
      return "Staff activity recorded";
  }
}

/**
 * Recent activity for one staff member from real `audit_events` only.
 * Filters by staffMemberId (preferred) or linked profile_id when present.
 */
export const loadStaffActivity = cache(
  async (
    staffMemberId: string,
    profileId: string | null,
  ): Promise<StaffActivityResult> => {
    if (!isUuid(staffMemberId) || !isSupabaseConfigured()) {
      return { items: [], error: null };
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("audit_events")
      .select("id, action, actor_id, metadata, created_at")
      .in("action", [...STAFF_ACTIVITY_ACTIONS])
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) {
      return { items: [], error: "unavailable" };
    }

    const matched = (data ?? []).filter((row) =>
      matchesStaffMember(row.metadata, staffMemberId, profileId),
    );

    const actorIds = [
      ...new Set(
        matched
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

    return {
      items: matched.slice(0, 25).map((row) => ({
        id: row.id,
        summary: describeStaffActivity(row.action, row.metadata),
        actorLabel: row.actor_id
          ? (actorNameById.get(row.actor_id) ?? null)
          : null,
        occurredAt: row.created_at,
      })),
      error: null,
    };
  },
);
