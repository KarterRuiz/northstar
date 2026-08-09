import "server-only";

import { cache } from "react";

import { loadAdminAttendanceOverviewMetrics } from "@/features/attendance/admin/load-admin-attendance-overview";
import { GENERIC_INFORMATION_LOAD_ERROR } from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { getAdminDashboardStats } from "./load-admin-dashboard-stats";

export type AdminActionItem = {
  id: string;
  label: string;
  count: number;
  /** Plain-English unit for the count, e.g. "class" / "classes". */
  countNoun: { one: string; other: string };
  href: string;
};

export type AdminActionItemsResult = {
  items: AdminActionItem[];
  /**
   * Soft degradation flag when a source query failed; items may still be partial.
   * Never contains technical DB messages — UI shows a fixed friendly line.
   */
  error: string | null;
};

function anyFailed(...flags: (string | undefined | null | boolean)[]): boolean {
  return flags.some((f) => Boolean(f));
}

/**
 * Leadership action queue for Admin Overview.
 * Only surfaces counts backed by clear workflow statuses.
 * Report-card gaps use the shared stats signal (completed terms only — no false “all missing”).
 */
export const loadAdminActionItems = cache(
  async (): Promise<AdminActionItemsResult> => {
    if (!isSupabaseConfigured()) {
      return { items: [], error: null };
    }

    const supabase = await createServerSupabaseClient();

    const [
      attendance,
      stats,
      transitionRes,
      parentRes,
      inviteRes,
      draftReportRes,
    ] = await Promise.all([
      loadAdminAttendanceOverviewMetrics(),
      getAdminDashboardStats(),
      supabase
        .from("transition_notes")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted"),
      supabase
        .from("parent_record_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "received"),
      supabase
        .from("staff_invitations")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("report_card_files")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft")
        .is("voided_at", null),
    ]);

    const error = anyFailed(
      stats.dbError,
      Boolean(transitionRes.error),
      Boolean(parentRes.error),
      Boolean(inviteRes.error),
      Boolean(draftReportRes.error),
    )
      ? GENERIC_INFORMATION_LOAD_ERROR
      : null;

    const reportMissing =
      stats.reportCardSignal.reportingStarted &&
      stats.reportCardSignal.coverageKnown
        ? stats.reportCardSignal.missingCount
        : 0;

    const candidates: AdminActionItem[] = [
      {
        id: "missing-attendance",
        label: "Classes still need attendance today",
        count: attendance.classesNotSubmitted,
        countNoun: { one: "class", other: "classes" },
        href: "/dashboard/admin/attendance?status=missing",
      },
      {
        id: "transition-notes",
        label: "Transition notes awaiting review",
        count: transitionRes.count ?? 0,
        countNoun: { one: "note", other: "notes" },
        href: "/dashboard/admin/academic-review?tn=submitted",
      },
      {
        id: "parent-requests",
        label: "Parent requests awaiting action",
        count: parentRes.count ?? 0,
        countNoun: { one: "request", other: "requests" },
        href: "/dashboard/admin/parent-requests?status=received",
      },
      {
        id: "staff-invites",
        label: "Staff invitations still pending",
        count: inviteRes.count ?? 0,
        countNoun: { one: "invitation", other: "invitations" },
        href: "/dashboard/admin/teachers",
      },
      {
        id: "report-cards-missing",
        label: "Students missing report cards for completed terms",
        count: reportMissing,
        countNoun: { one: "student", other: "students" },
        href: "/dashboard/admin/report-cards",
      },
      {
        id: "draft-report-cards",
        label: "Report cards awaiting finalization",
        count: draftReportRes.count ?? 0,
        countNoun: { one: "report card", other: "report cards" },
        href: "/dashboard/admin/report-cards",
      },
    ];

    return {
      items: candidates.filter((item) => item.count > 0),
      error,
    };
  },
);
