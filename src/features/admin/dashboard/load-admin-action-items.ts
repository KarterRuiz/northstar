import "server-only";

import { cache } from "react";

import type { Role } from "@/config/roles";
import { loadAdminAttendanceOverviewMetrics } from "@/features/attendance/admin/load-admin-attendance-overview";
import { fetchStaffDirectorySummary } from "@/features/admin/staff-directory/staff-directory-queries";
import { GENERIC_INFORMATION_LOAD_ERROR } from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { getAdminDashboardStats } from "./load-admin-dashboard-stats";

export type AdminFocusUrgency = "action_needed" | "needs_attention" | "pending";

export type AdminActionItem = {
  id: string;
  /** Short category for the focus row (e.g. Attendance). */
  category: string;
  /** Concise leadership message — not a paragraph. */
  label: string;
  count: number;
  /** Plain-English unit for the count, e.g. "class" / "classes". */
  countNoun: { one: string; other: string };
  href: string;
  urgency: AdminFocusUrgency;
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

function workspacePath(role: Role, path: string): string {
  return `/dashboard/${role}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Leadership action queue for Admin Overview ("Today's Focus").
 * Only surfaces counts backed by clear workflow statuses.
 * Report-card gaps use the shared stats signal (completed terms only — no false “all missing”).
 * Ordered by operational urgency. Zero-count rows are omitted.
 */
export const loadAdminActionItems = cache(
  async (role: Role = "admin"): Promise<AdminActionItemsResult> => {
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
      staffSummary,
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
      fetchStaffDirectorySummary(),
    ]);

    const error = anyFailed(
      stats.dbError,
      Boolean(transitionRes.error),
      Boolean(parentRes.error),
      Boolean(inviteRes.error),
      Boolean(draftReportRes.error),
      staffSummary.error,
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
        category: "Attendance",
        label: "Classes still need attendance today",
        count: attendance.classesNotSubmitted,
        countNoun: { one: "class", other: "classes" },
        href: workspacePath(role, "/attendance?status=missing"),
        urgency:
          attendance.classesNotSubmitted >= 5
            ? "action_needed"
            : "needs_attention",
      },
      {
        id: "attendance-follow-up",
        category: "Attendance",
        label: "Students needing attendance follow-up",
        count: attendance.studentsNeedingFollowUp,
        countNoun: { one: "student", other: "students" },
        href: workspacePath(role, "/attendance"),
        urgency:
          attendance.studentsNeedingFollowUp >= 10
            ? "action_needed"
            : "needs_attention",
      },
      {
        id: "parent-requests",
        category: "Parent requests",
        label: "Parent requests awaiting action",
        count: parentRes.count ?? 0,
        countNoun: { one: "request", other: "requests" },
        href: workspacePath(role, "/parent-requests?status=received"),
        urgency:
          (parentRes.count ?? 0) >= 10 ? "action_needed" : "needs_attention",
      },
      {
        id: "transition-notes",
        category: "Transition notes",
        label: "Transition notes awaiting review",
        count: transitionRes.count ?? 0,
        countNoun: { one: "note", other: "notes" },
        href: workspacePath(role, "/academic-review?tn=submitted"),
        urgency:
          (transitionRes.count ?? 0) >= 10
            ? "action_needed"
            : "needs_attention",
      },
      {
        id: "report-cards-missing",
        category: "Report cards",
        label: "Students missing report cards for completed terms",
        count: reportMissing,
        countNoun: { one: "student", other: "students" },
        href: workspacePath(role, "/report-cards"),
        urgency: reportMissing >= 10 ? "action_needed" : "needs_attention",
      },
      {
        id: "draft-report-cards",
        category: "Report cards",
        label: "Report cards awaiting finalization",
        count: draftReportRes.count ?? 0,
        countNoun: { one: "report card", other: "report cards" },
        href: workspacePath(role, "/report-cards"),
        urgency: "pending",
      },
      {
        id: "staff-invites",
        category: "Staff",
        label: "Staff invitations still pending",
        count: inviteRes.count ?? 0,
        countNoun: { one: "invitation", other: "invitations" },
        href: workspacePath(role, "/teachers"),
        urgency: "pending",
      },
      {
        id: "staff-ready-to-invite",
        category: "Staff",
        label: "Staff ready to invite",
        count: staffSummary.readyToInvite,
        countNoun: { one: "person", other: "people" },
        href: workspacePath(role, "/teachers"),
        urgency: "pending",
      },
    ];

    return {
      items: candidates.filter((item) => item.count > 0).slice(0, 5),
      error,
    };
  },
);
