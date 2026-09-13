import "server-only";

import { cache } from "react";

import { todayIso } from "@/features/attendance/attendance-date-utils";
import { OPERATIONAL_ACTIVE_ENROLLMENT_STATUS } from "@/features/students/active-student-enrollments";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
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

/**
 * Report-card operational signal.
 * "Reporting started" only when at least one term in the current school year
 * has ended (terms.ends_on < today). Until then we never warn about missing PDFs.
 * When coverage cannot be loaded, coverageKnown is false — UI must not claim "Complete".
 */
export type AdminReportCardSignal = {
  reportingStarted: boolean;
  /** False when file coverage could not be queried after a cycle started. */
  coverageKnown: boolean;
  schoolYearLabel: string | null;
  /** Term codes (e.g. T1) that have ended and are expected to have PDFs. */
  completedTermCodes: string[];
  missingCount: number;
};

export type AdminDashboardStats = {
  activeStudentCount: number;
  activeClassCount: number;
  pendingTransitionNotesCount: number;
  /** Mirror of reportCardSignal.missingCount for existing callers. */
  missingReportCardsCount: number;
  reportCardSignal: AdminReportCardSignal;
  pendingParentRequestsLast30Days: number;
  recentParentRequests: AdminRecentParentRequest[];
  /** When set, cards show a soft empty / degraded state instead of failing the page. */
  dbError: string | null;
};

function emptyReportCardSignal(): AdminReportCardSignal {
  return {
    reportingStarted: false,
    coverageKnown: true,
    schoolYearLabel: null,
    completedTermCodes: [],
    missingCount: 0,
  };
}

function emptyStats(dbError: string | null): AdminDashboardStats {
  return {
    activeStudentCount: 0,
    activeClassCount: 0,
    pendingTransitionNotesCount: 0,
    missingReportCardsCount: 0,
    reportCardSignal: emptyReportCardSignal(),
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

function softDbError(raw: string | null): string | null {
  // Sentinel only — Overview UI never surfaces the technical string.
  if (!raw) return null;
  logServerError("admin-dashboard.stats", raw);
  return GENERIC_INFORMATION_LOAD_ERROR;
}

/**
 * Loads admin overview metrics in a small number of round-trips.
 * Active students = distinct `student_id` with ≥1 operationally active enrollment
 * (`status = active` AND class `is_active = true`). See active-student-enrollments.ts.
 * (Bounded fetch: student_id + inner class; TODO: RPC for very large rosters).
 */
export const getAdminDashboardStats = cache(
  async (): Promise<AdminDashboardStats> => {
    if (!isSupabaseConfigured()) {
      return emptyStats(GENERIC_INFORMATION_LOAD_ERROR);
    }

    const supabase = await createServerSupabaseClient();
    const since = thirtyDaysAgoIso();
    const today = todayIso();

    const [
      enrollmentsRes,
      classesRes,
      transitionRes,
      currentYearResult,
      parentPendingRes,
      parentRecentRes,
    ] = await Promise.all([
      supabase
        .from("student_enrollments")
        .select("student_id, classes!inner ( id )")
        .eq("status", OPERATIONAL_ACTIVE_ENROLLMENT_STATUS)
        .eq("classes.is_active", true),
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("transition_notes")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted"),
      loadCurrentSchoolYear(supabase),
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

    const schoolYear = currentYearResult.ok ? currentYearResult.year : null;
    const schoolYearLoadError = currentYearResult.ok
      ? undefined
      : currentYearResult.error;

    const batchError = firstError(
      enrollmentsRes.error?.message,
      classesRes.error?.message,
      transitionRes.error?.message,
      schoolYearLoadError,
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

    let reportCardSignal = emptyReportCardSignal();
    const currentYearLabel = schoolYear?.label?.trim() ?? null;

    if (schoolYear?.id && currentYearLabel && !batchError) {
      reportCardSignal = {
        ...emptyReportCardSignal(),
        schoolYearLabel: currentYearLabel,
      };

      const termsRes = await supabase
        .from("terms")
        .select("code, ends_on")
        .eq("school_year_id", schoolYear.id)
        .order("starts_on", { ascending: true });

      if (termsRes.error) {
        return {
          activeStudentCount,
          activeClassCount,
          pendingTransitionNotesCount,
          missingReportCardsCount: 0,
          reportCardSignal,
          pendingParentRequestsLast30Days,
          recentParentRequests,
          dbError: softDbError(termsRes.error.message),
        };
      }

      const completedTermCodes = (termsRes.data ?? [])
        .filter((t) => Boolean(t.ends_on) && t.ends_on! < today)
        .map((t) => t.code.trim())
        .filter(Boolean);

      // No completed terms → reporting cycle has not started; never warn.
      if (completedTermCodes.length === 0 || activeStudentIds.size === 0) {
        reportCardSignal = {
          reportingStarted: false,
          coverageKnown: true,
          schoolYearLabel: currentYearLabel,
          completedTermCodes: [],
          missingCount: 0,
        };
      } else {
        const filesRes = await supabase
          .from("report_card_files")
          .select("student_id, term")
          .eq("school_year", currentYearLabel)
          .in("term", completedTermCodes)
          .is("voided_at", null);

        if (filesRes.error) {
          return {
            activeStudentCount,
            activeClassCount,
            pendingTransitionNotesCount,
            missingReportCardsCount: 0,
            reportCardSignal: {
              reportingStarted: true,
              coverageKnown: false,
              schoolYearLabel: currentYearLabel,
              completedTermCodes,
              missingCount: 0,
            },
            pendingParentRequestsLast30Days,
            recentParentRequests,
            dbError: softDbError(filesRes.error.message),
          };
        }

        const coveredByTerm = new Map<string, Set<string>>();
        for (const code of completedTermCodes) {
          coveredByTerm.set(code, new Set());
        }
        for (const row of filesRes.data ?? []) {
          const term = row.term?.trim();
          if (!term) continue;
          coveredByTerm.get(term)?.add(row.student_id);
        }

        let missingCount = 0;
        for (const sid of activeStudentIds) {
          const missingTerm = completedTermCodes.some(
            (code) => !coveredByTerm.get(code)?.has(sid),
          );
          if (missingTerm) missingCount += 1;
        }

        reportCardSignal = {
          reportingStarted: true,
          coverageKnown: true,
          schoolYearLabel: currentYearLabel,
          completedTermCodes,
          missingCount,
        };
      }
    }

    return {
      activeStudentCount,
      activeClassCount,
      pendingTransitionNotesCount,
      missingReportCardsCount: reportCardSignal.missingCount,
      reportCardSignal,
      pendingParentRequestsLast30Days,
      recentParentRequests,
      dbError: softDbError(batchError),
    };
  },
);
