import "server-only";

import { cache } from "react";

import type { Role } from "@/config/roles";
import { loadAdminAttendanceData } from "@/features/attendance/admin/load-admin-attendance-data";
import { getAdminDashboardStats } from "@/features/admin/dashboard/load-admin-dashboard-stats";
import { logServerError } from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  shouldSurfaceMissingClass,
  shouldSurfaceReportCardFollowUp,
} from "./classify";
import { DERIVED_SIGNAL_CAP } from "./constants";
import type { FollowUpItem } from "./types";

export type DerivedSignalsResult = {
  items: FollowUpItem[];
  failedSources: string[];
};

function emptyRelated(): FollowUpItem["related"] {
  return {
    studentId: null,
    studentLabel: null,
    staffMemberId: null,
    staffLabel: null,
    classId: null,
    classLabel: null,
    parentRequestId: null,
    parentRequestLabel: null,
    transitionNoteId: null,
  };
}

function workspacePath(role: Role, path: string): string {
  return `/dashboard/${role}${path.startsWith("/") ? path : `/${path}`}`;
}

function displayStudentName(row: {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
}): string {
  const pref = row.preferred_name?.trim();
  if (pref) return pref;
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Student";
}

async function isolate<T>(
  source: string,
  failedSources: string[],
  fn: () => PromiseLike<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logServerError(`follow-up.${source}`, error);
    failedSources.push(source);
    return fallback;
  }
}

type SoftQuery<T> = { data: T | null; error: { message: string } | null };

async function isolateQuery<T>(
  source: string,
  failedSources: string[],
  fn: () => PromiseLike<SoftQuery<T>>,
): Promise<SoftQuery<T>> {
  try {
    const result = await fn();
    if (result.error) {
      logServerError(`follow-up.${source}`, result.error.message);
      failedSources.push(source);
    }
    return result;
  } catch (error) {
    logServerError(`follow-up.${source}`, error);
    failedSources.push(source);
    return { data: null, error: { message: "unavailable" } };
  }
}

/**
 * Live exceptions only. Nothing is persisted. Routine success is omitted.
 * Each source is isolated so one failure cannot blank the rest of Follow-Up.
 */
export const loadDerivedFollowUpSignals = cache(
  async (role: Role, today: string): Promise<DerivedSignalsResult> => {
    if (!isSupabaseConfigured()) {
      return { items: [], failedSources: ["config"] };
    }

    const supabase = await createServerSupabaseClient();
    const items: FollowUpItem[] = [];
    const failedSources: string[] = [];

    const [attendance, stats, pendingInvitesRes, draftStaffRes, parentRes, notesRes] =
      await Promise.all([
        isolate("attendance", failedSources, () =>
          loadAdminAttendanceData({
            date: today,
            schoolYear: null,
            gradeId: null,
            classId: null,
            status: null,
          }),
        { ok: false as const, message: "unavailable" },
        ),
        isolate("report_cards", failedSources, () => getAdminDashboardStats(), null),
        isolateQuery(
          "staff_invites",
          failedSources,
          async () =>
            await supabase
              .from("staff_invitations")
              .select("id, staff_member_id, full_name, email, expires_at, created_at")
              .eq("status", "pending")
              .gt("expires_at", new Date().toISOString())
              .order("created_at", { ascending: true })
              .limit(DERIVED_SIGNAL_CAP),
        ),
        isolateQuery(
          "staff_drafts",
          failedSources,
          async () =>
            await supabase
              .from("staff_members")
              .select("id, full_name, email, status, archived_at, profile_id")
              .eq("status", "draft")
              .is("archived_at", null)
              .is("profile_id", null)
              .limit(40),
        ),
        isolateQuery(
          "parent_requests",
          failedSources,
          async () =>
            await supabase
              .from("parent_record_requests")
              .select("id, student_id, requester_name, status, created_at")
              .in("status", ["received", "approved"])
              .order("created_at", { ascending: true })
              .limit(DERIVED_SIGNAL_CAP),
        ),
        isolateQuery(
          "transition_notes",
          failedSources,
          async () =>
            await supabase
              .from("transition_notes")
              .select("id, student_id, created_at")
              .eq("status", "submitted")
              .order("created_at", { ascending: true })
              .limit(DERIVED_SIGNAL_CAP),
        ),
      ]);

    if (attendance && "ok" in attendance && attendance.ok) {
      const missing = attendance.classRows
        .filter((row) => shouldSurfaceMissingClass(row.submitted, row.totalStudents))
        .slice(0, DERIVED_SIGNAL_CAP);
      for (const row of missing) {
        items.push({
          id: `derived:attendance_missing_class:${row.classId}`,
          kind: "derived",
          title: `${row.classLabel} still needs today’s attendance`,
          note: null,
          category: "classes",
          status: "open",
          dueOn: today,
          ownerLabel: row.teacherLabel !== "—" ? row.teacherLabel : null,
          href: workspacePath(role, `/attendance?status=missing&classId=${row.classId}`),
          sourceType: "attendance_missing_class",
          sourceId: row.classId,
          createdAt: `${today}T00:00:00.000Z`,
          completedAt: null,
          related: {
            ...emptyRelated(),
            classId: row.classId,
            classLabel: row.classLabel,
          },
        });
      }

      for (const row of attendance.followUpRows.slice(0, DERIVED_SIGNAL_CAP)) {
        items.push({
          id: `derived:attendance_student:${row.studentId}:${row.classId}`,
          kind: "derived",
          title: `${row.studentName} needs attendance follow-up`,
          note: null,
          category: "students",
          status: "open",
          dueOn: today,
          ownerLabel: null,
          href: workspacePath(role, `/students/${row.studentId}/attendance`),
          sourceType: "attendance_student",
          sourceId: row.studentId,
          createdAt: `${today}T00:00:00.000Z`,
          completedAt: null,
          related: {
            ...emptyRelated(),
            studentId: row.studentId,
            studentLabel: row.studentName,
            classId: row.classId,
            classLabel: row.classLabel,
          },
        });
      }
    } else if (attendance && "ok" in attendance && !attendance.ok) {
      if (!failedSources.includes("attendance")) failedSources.push("attendance");
    }

    for (const invite of pendingInvitesRes.data ?? []) {
      const name = invite.full_name?.trim() || invite.email;
      items.push({
        id: `derived:staff_pending_invite:${invite.id}`,
        kind: "derived",
        title: `Staff invitation pending for ${name}`,
        note: null,
        category: "staff",
        status: "waiting",
        dueOn: null,
        ownerLabel: null,
        href: invite.staff_member_id
          ? workspacePath(role, `/teachers/${invite.staff_member_id}`)
          : workspacePath(role, "/teachers"),
        sourceType: "staff_pending_invite",
        sourceId: invite.id,
        createdAt: invite.created_at ?? `${today}T00:00:00.000Z`,
        completedAt: null,
        related: {
          ...emptyRelated(),
          staffMemberId: invite.staff_member_id,
          staffLabel: name,
        },
      });
    }

    const draftsMissingEmail = (draftStaffRes.data ?? [])
      .filter((row) => !row.email?.trim())
      .slice(0, DERIVED_SIGNAL_CAP);
    for (const member of draftsMissingEmail) {
      items.push({
        id: `derived:staff_draft_missing_email:${member.id}`,
        kind: "derived",
        title: `${member.full_name} still needs an email before invite`,
        note: null,
        category: "staff",
        status: "open",
        dueOn: today,
        ownerLabel: null,
        href: workspacePath(role, `/teachers/${member.id}`),
        sourceType: "staff_draft_missing_email",
        sourceId: member.id,
        createdAt: `${today}T00:00:00.000Z`,
        completedAt: null,
        related: {
          ...emptyRelated(),
          staffMemberId: member.id,
          staffLabel: member.full_name,
        },
      });
    }

    const parentRows = parentRes.data ?? [];
    const parentStudentIds = [...new Set(parentRows.map((r) => r.student_id))];
    const parentStudents =
      parentStudentIds.length > 0
        ? await supabase
            .from("students")
            .select("id, first_name, last_name, preferred_name")
            .in("id", parentStudentIds)
        : { data: [] as const, error: null };
    if (parentStudents.error) {
      logServerError("follow-up.parentStudents", parentStudents.error.message);
    }
    const parentStudentNames = new Map(
      (parentStudents.data ?? []).map((s) => [s.id, displayStudentName(s)]),
    );
    for (const req of parentRows) {
      const studentLabel = parentStudentNames.get(req.student_id) ?? "Student";
      items.push({
        id: `derived:parent_request_open:${req.id}`,
        kind: "derived",
        title: `Parent request from ${req.requester_name} still needs a response`,
        note: null,
        category: "families",
        status: "open",
        dueOn: today,
        ownerLabel: null,
        href: workspacePath(role, `/parent-requests/${req.id}`),
        sourceType: "parent_request_open",
        sourceId: req.id,
        createdAt: req.created_at,
        completedAt: null,
        related: {
          ...emptyRelated(),
          studentId: req.student_id,
          studentLabel,
          parentRequestId: req.id,
          parentRequestLabel: req.requester_name,
        },
      });
    }

    if (stats) {
      const signal = stats.reportCardSignal;
      if (
        shouldSurfaceReportCardFollowUp({
          reportingStarted: signal.reportingStarted,
          coverageKnown: signal.coverageKnown,
          missingCount: signal.missingCount,
        })
      ) {
        const n = signal.missingCount;
        items.push({
          id: "derived:report_cards_missing",
          kind: "derived",
          title:
            n === 1
              ? "One student is still missing a report card for ended terms"
              : `${n} students are still missing report cards for ended terms`,
          note: null,
          category: "records",
          status: "open",
          dueOn: today,
          ownerLabel: null,
          href: workspacePath(role, "/report-cards"),
          sourceType: "report_cards_missing",
          sourceId: signal.schoolYearLabel,
          createdAt: `${today}T00:00:00.000Z`,
          completedAt: null,
          related: emptyRelated(),
        });
      }
    }

    const noteRows = notesRes.data ?? [];
    const noteStudentIds = [...new Set(noteRows.map((n) => n.student_id))];
    const noteStudents =
      noteStudentIds.length > 0
        ? await supabase
            .from("students")
            .select("id, first_name, last_name, preferred_name")
            .in("id", noteStudentIds)
        : { data: [] as const, error: null };
    if (noteStudents.error) {
      logServerError("follow-up.noteStudents", noteStudents.error.message);
    }
    const noteStudentNames = new Map(
      (noteStudents.data ?? []).map((s) => [s.id, displayStudentName(s)]),
    );
    for (const note of noteRows) {
      const studentLabel = noteStudentNames.get(note.student_id) ?? "Student";
      items.push({
        id: `derived:transition_note_submitted:${note.id}`,
        kind: "derived",
        title: `Transition note awaiting review · ${studentLabel}`,
        note: null,
        category: "students",
        status: "open",
        dueOn: today,
        ownerLabel: null,
        href: workspacePath(role, `/students/${note.student_id}/transition-notes`),
        sourceType: "transition_note_submitted",
        sourceId: note.id,
        createdAt: note.created_at,
        completedAt: null,
        related: {
          ...emptyRelated(),
          studentId: note.student_id,
          studentLabel,
          transitionNoteId: note.id,
        },
      });
    }

    return { items, failedSources };
  },
);
