import "server-only";

import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminRecentParentRequest = {
  id: string;
  status: string;
  requester_email: string;
  requester_name: string;
  created_at: string;
  student_id: string;
};

export type AdminDashboardStats = {
  activeStudentCount: number;
  activeClassCount: number;
  pendingTransitionNotesCount: number;
  missingReportCardsCount: number;
  pendingParentRequestsLast30Days: number;
  recentParentRequests: AdminRecentParentRequest[];
  /** When set, cards show a soft empty / degraded state instead of failing the page. */
  dbError: string | null;
};

function emptyStats(dbError: string | null): AdminDashboardStats {
  return {
    activeStudentCount: 0,
    activeClassCount: 0,
    pendingTransitionNotesCount: 0,
    missingReportCardsCount: 0,
    pendingParentRequestsLast30Days: 0,
    recentParentRequests: [],
    dbError,
  };
}

function thirtyDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

function firstError(...messages: (string | undefined)[]): string | null {
  for (const m of messages) {
    if (m) return m;
  }
  return null;
}

/**
 * Loads admin overview metrics in a small number of round-trips.
 * Active students = distinct `student_id` with at least one `active` enrollment
 * (bounded fetch: only `student_id` column; TODO: RPC for very large rosters).
 */
export const getAdminDashboardStats = cache(
  async (): Promise<AdminDashboardStats> => {
    if (!isSupabaseConfigured()) {
      return emptyStats("Supabase is not configured.");
    }

    const supabase = await createServerSupabaseClient();
    const since = thirtyDaysAgoIso();

    const [
      enrollmentsRes,
      classesRes,
      transitionRes,
      schoolYearRes,
      parentPendingRes,
      parentRecentRes,
    ] = await Promise.all([
      supabase
        .from("student_enrollments")
        .select("student_id")
        .eq("status", "active"),
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("transition_notes")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted"),
      supabase
        .from("school_years")
        .select("label")
        .order("starts_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("parent_record_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "received")
        .gte("created_at", since),
      supabase
        .from("parent_record_requests")
        .select(
          "id, status, requester_email, requester_name, created_at, student_id",
        )
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const batchError = firstError(
      enrollmentsRes.error?.message,
      classesRes.error?.message,
      transitionRes.error?.message,
      schoolYearRes.error?.message,
      parentPendingRes.error?.message,
      parentRecentRes.error?.message,
    );

    const activeStudentIds = new Set(
      enrollmentsRes.data?.map((r) => r.student_id) ?? [],
    );
    const activeStudentCount = activeStudentIds.size;
    const activeClassCount = classesRes.count ?? 0;
    const pendingTransitionNotesCount = transitionRes.count ?? 0;
    const pendingParentRequestsLast30Days = parentPendingRes.count ?? 0;

    const recentParentRequests: AdminRecentParentRequest[] = (
      parentRecentRes.data ?? []
    ).map((r) => ({
      id: r.id,
      status: r.status,
      requester_email: r.requester_email,
      requester_name: r.requester_name,
      created_at: r.created_at,
      student_id: r.student_id,
    }));

    let missingReportCardsCount = 0;
    const currentYearLabel = schoolYearRes.data?.label?.trim();

    if (currentYearLabel && activeStudentIds.size > 0 && !batchError) {
      const filesRes = await supabase
        .from("report_card_files")
        .select("student_id")
        .eq("school_year", currentYearLabel);

      if (filesRes.error) {
        return {
          activeStudentCount,
          activeClassCount,
          pendingTransitionNotesCount,
          missingReportCardsCount: 0,
          pendingParentRequestsLast30Days,
          recentParentRequests,
          dbError: filesRes.error.message,
        };
      }

      const covered = new Set(
        filesRes.data?.map((row) => row.student_id) ?? [],
      );
      for (const sid of activeStudentIds) {
        if (!covered.has(sid)) missingReportCardsCount += 1;
      }
    } else if (activeStudentIds.size === 0) {
      missingReportCardsCount = 0;
    } else if (!currentYearLabel) {
      missingReportCardsCount = 0;
    }

    return {
      activeStudentCount,
      activeClassCount,
      pendingTransitionNotesCount,
      missingReportCardsCount,
      pendingParentRequestsLast30Days,
      recentParentRequests,
      dbError: batchError,
    };
  },
);
