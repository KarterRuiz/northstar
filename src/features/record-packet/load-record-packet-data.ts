import "server-only";

import {
  loadReportCardsForStudent,
  type ReportCardListItem,
} from "@/features/report-cards/load-report-cards-for-student";
import {
  loadStudentProfileResult,
  type ProfileLoadResult,
} from "@/features/students/profile/supabase-profile-data";
import type { StudentProfile } from "@/features/students/profile/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  isParentRequestStatus,
  parentRequestStatusLabel,
  type ParentRequestStatus,
} from "@/features/parent-requests/constants";

export type EnrollmentHistoryRow = {
  id: string;
  status: string;
  createdAt: string;
  schoolYearLabel: string;
  classLabel: string;
  gradeLevel: string;
};

export type TransitionPacketNote = {
  id: string;
  status: string;
  updatedAt: string;
  summary: string;
};

export type ParentRequestPacketRow = {
  id: string;
  status: ParentRequestStatus;
  statusLabel: string;
  requesterName: string;
  createdAt: string;
};

type TransitionRow = {
  id: string;
  status: string;
  updated_at: string;
  academic_strengths: string;
  academic_needs: string;
  recommended_next_steps: string;
};

function buildTransitionSummary(row: TransitionRow): string {
  const parts = [
    row.academic_strengths,
    row.academic_needs,
    row.recommended_next_steps,
  ]
    .map((s) => s?.trim())
    .filter(Boolean);
  const text = parts.join(" · ") || "No narrative captured yet.";
  return text.length > 280 ? `${text.slice(0, 277)}…` : text;
}

function classLabelFromEmbed(c: {
  name: string;
  section: string | null;
} | null): string {
  if (!c) return "—";
  const base = c.name?.trim() || "Class";
  const sec = c.section?.trim();
  return sec ? `${base} · ${sec}` : base;
}

function gradeFromEmbed(c: {
  grade_levels:
    | { name: string }
    | { name: string }[]
    | null;
} | null): string {
  if (!c?.grade_levels) return "—";
  const gl = c.grade_levels;
  const row = Array.isArray(gl) ? gl[0] : gl;
  return row?.name?.trim() || "—";
}

export type RecordPacketPayload =
  | {
      ok: true;
      profile: StudentProfile;
      enrollments: EnrollmentHistoryRow[];
      reportCards: ReportCardListItem[];
      reportCardsError: string | null;
      transitionNotes: TransitionPacketNote[];
      parentRequests: ParentRequestPacketRow[];
    }
  | { ok: false; message: string };

export async function loadRecordPacketPayload(
  studentId: string,
): Promise<RecordPacketPayload> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const profileLoad: ProfileLoadResult =
    await loadStudentProfileResult(studentId);
  if (profileLoad.kind === "not_found") {
    return { ok: false, message: "Student not found." };
  }
  if (profileLoad.kind === "error") {
    return { ok: false, message: profileLoad.message };
  }

  const supabase = await createServerSupabaseClient();

  const [enrRes, tnRes, parentRes, rcRes] = await Promise.all([
    supabase
      .from("student_enrollments")
      .select("id, status, created_at, class_id, school_year_id")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("transition_notes")
      .select(
        "id, status, updated_at, academic_strengths, academic_needs, recommended_next_steps",
      )
      .eq("student_id", studentId)
      .neq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("parent_record_requests")
      .select(
        "id, status, requester_name, created_at",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    loadReportCardsForStudent(supabase, studentId),
  ]);

  if (enrRes.error) {
    return { ok: false, message: enrRes.error.message };
  }

  const enrRows = enrRes.data ?? [];
  const classIds = [...new Set(enrRows.map((r) => r.class_id))];
  const yearIds = [...new Set(enrRows.map((r) => r.school_year_id))];

  type ClassRow = {
    id: string;
    name: string;
    section: string | null;
    grade_levels: { name: string } | { name: string }[] | null;
  };

  const yearLabelById = new Map<string, string>();
  const classById = new Map<string, ClassRow>();

  if (yearIds.length > 0) {
    const { data: years, error: yearErr } = await supabase
      .from("school_years")
      .select("id, label")
      .in("id", yearIds);
    if (yearErr) {
      return { ok: false, message: yearErr.message };
    }
    for (const y of years ?? []) {
      yearLabelById.set(y.id, y.label?.trim() || "—");
    }
  }

  if (classIds.length > 0) {
    const { data: classes, error: classErr } = await supabase
      .from("classes")
      .select("id, name, section, grade_levels ( name )")
      .in("id", classIds);
    if (classErr) {
      return { ok: false, message: classErr.message };
    }
    for (const c of (classes ?? []) as unknown as ClassRow[]) {
      classById.set(c.id, c);
    }
  }

  const enrollments: EnrollmentHistoryRow[] = enrRows.map((row) => {
    const klass = classById.get(row.class_id) ?? null;
    return {
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      schoolYearLabel: yearLabelById.get(row.school_year_id) ?? "—",
      classLabel: classLabelFromEmbed(klass),
      gradeLevel: gradeFromEmbed(klass),
    };
  });

  const transitionNotes: TransitionPacketNote[] = tnRes.error
    ? []
    : ((tnRes.data ?? []) as TransitionRow[]).map((row) => ({
        id: row.id,
        status: row.status,
        updatedAt: row.updated_at,
        summary: buildTransitionSummary(row),
      }));

  const parentRequests: ParentRequestPacketRow[] = parentRes.error
    ? []
    : (parentRes.data ?? []).map((row: {
        id: string;
        status: string;
        requester_name: string;
        created_at: string;
      }) => {
        const st = row.status as string;
        const status = isParentRequestStatus(st) ? st : "received";
        return {
          id: row.id,
          status,
          statusLabel: parentRequestStatusLabel(status),
          requesterName: row.requester_name,
          createdAt: row.created_at,
        };
      });

  return {
    ok: true,
    profile: profileLoad.profile,
    enrollments,
    reportCards: rcRes.items,
    reportCardsError: rcRes.listError,
    transitionNotes,
    parentRequests,
  };
}
