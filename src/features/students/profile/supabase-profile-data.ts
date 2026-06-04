import "server-only";

import { cache } from "react";

import { canManageStudents, isRole, roleLabels, type Role } from "@/config/roles";
import { loadReportCardsForStudent } from "@/features/report-cards/load-report-cards-for-student";
import { assertTeacherCanAccessStudent } from "@/lib/auth/report-card-upload-role";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import type {
  AuditEvent,
  GradeRow,
  ReportCardSummary,
  StudentDivision,
  StudentFile,
  StudentProfile,
  TransitionNote,
  TransitionNoteStatus,
} from "./types";

export type ProfileLoadResult =
  | { kind: "ok"; profile: StudentProfile }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

type ClassEmbed = {
  name: string;
  section: string | null;
  grade_levels: { name: string } | { name: string }[] | null;
};
type EnrollmentEmbed = {
  status: string;
  classes: ClassEmbed | ClassEmbed[] | null;
};
type StudentEmbedRow = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  external_id: string | null;
  student_enrollments: EnrollmentEmbed | EnrollmentEmbed[] | null;
};

function displayName(s: {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
}): string {
  const pref = s.preferred_name?.trim();
  if (pref) return pref;
  return [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "—";
}

function classLabel(c: ClassEmbed | null): string {
  if (!c) return "—";
  const base = c.name?.trim() || "Class";
  const sec = c.section?.trim();
  return sec ? `${base} · ${sec}` : base;
}

function gradeName(c: ClassEmbed | null): string {
  if (!c?.grade_levels) return "—";
  const gl = c.grade_levels;
  const row = Array.isArray(gl) ? gl[0] : gl;
  return row?.name?.trim() || "—";
}

function inferDivision(gradeName: string): StudentDivision {
  const m = gradeName.match(/\d+/);
  const n = m ? Number.parseInt(m[0]!, 10) : NaN;
  if (Number.isFinite(n)) {
    if (n <= 5) return "lower";
    if (n <= 8) return "middle";
    return "upper";
  }
  return "middle";
}

function enrollmentStatusToProfile(
  statusRaw: string,
): StudentProfile["status"] {
  switch (statusRaw) {
    case "active":
      return "active";
    case "withdrawn":
      return "leave";
    case "graduated":
      return "graduated";
    case "inactive":
      return "inactive";
    default:
      return "active";
  }
}

function normalizeEnrollment(
  row: StudentEmbedRow,
): { status: string; klass: ClassEmbed | null } | null {
  const raw = row.student_enrollments;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0) return null;
  const active = list.filter((e) => e.status === "active");
  const pool = active.length > 0 ? active : list;
  const ranked = [...pool].sort((a, b) =>
    classLabel(
      (Array.isArray(a.classes) ? a.classes[0] : a.classes) ?? null,
    ).localeCompare(
      classLabel(
        (Array.isArray(b.classes) ? b.classes[0] : b.classes) ?? null,
      ),
    ),
  );
  const first = ranked[0]!;
  const klass =
    (Array.isArray(first.classes) ? first.classes[0] : first.classes) ?? null;
  return { status: first.status, klass };
}

export const loadStudentProfileResult = cache(
  async (studentId: string): Promise<ProfileLoadResult> => {
    if (!isSupabaseConfigured()) {
      return { kind: "error", message: "Supabase is not configured." };
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("students")
      .select(
        `
        id,
        first_name,
        last_name,
        preferred_name,
        external_id,
        student_enrollments (
          status,
          classes ( name, section, grade_levels ( name ) )
        )
      `,
      )
      .eq("id", studentId)
      .maybeSingle();

    if (error) {
      return { kind: "error", message: error.message };
    }
    if (!data) {
      return { kind: "not_found" };
    }

    const row = data as unknown as StudentEmbedRow;
    const en = normalizeEnrollment(row);
    const klass = en?.klass ?? null;
    const gname = gradeName(klass);
    const homeroom = en ? classLabel(klass) : "No active enrollment";
    const statusRaw = en?.status ?? "active";
    const status = enrollmentStatusToProfile(statusRaw);

    const profile: StudentProfile = {
      id: row.id,
      fullName: displayName(row),
      studentNumber: row.external_id?.trim() || "—",
      division: inferDivision(gname),
      gradeLevel: gname,
      homeroom,
      status,
      dateOfBirth: "—",
      tags: [],
    };

    return { kind: "ok", profile };
  },
);

export const getStudentProfile = cache(
  async (studentId: string): Promise<StudentProfile | null> => {
    const r = await loadStudentProfileResult(studentId);
    return r.kind === "ok" ? r.profile : null;
  },
);

export async function getStudentGrades(studentId: string): Promise<GradeRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("academic_records")
    .select(
      "id, subject, term, score_or_grade, performance_level, status, updated_at, classes ( name, section )",
    )
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return [];

  return (data ?? []).map((row) => {
    const classesRaw = (
      row as {
        classes: { name: string; section: string | null } | { name: string; section: string | null }[] | null;
      }
    ).classes;
    const klass = Array.isArray(classesRaw) ? (classesRaw[0] ?? null) : classesRaw;
    const classLabel = klass
      ? [klass.name?.trim(), klass.section?.trim()].filter(Boolean).join(" · ")
      : "—";
    const term = (row.term as string | null)?.trim() || "—";
    const grade = (row.score_or_grade as string | null)?.trim() || "—";
    return {
      id: row.id as string,
      courseCode: classLabel,
      courseTitle: (row.subject as string)?.trim() || "—",
      term,
      grade,
      performanceLevel: (row.performance_level as string | null)?.trim() || null,
      status: (row.status as string) ?? "draft",
      updatedAt: (row.updated_at as string).slice(0, 10),
    };
  });
}

export async function getReportCardSummaries(
  studentId: string,
): Promise<ReportCardSummary[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const { items, listError } = await loadReportCardsForStudent(
    supabase,
    studentId,
  );
  if (listError) return [];

  return items.map((it) => ({
    id: it.id,
    academicYear: it.schoolYear,
    termLabel: it.term,
    issuedOn: it.createdAt.slice(0, 10),
    status: it.status,
    headline: it.title?.trim() || "PDF report card",
  }));
}

export type ReportCardsTabResult = {
  rows: ReportCardSummary[];
  listError: string | null;
};

export async function loadReportCardSummariesForTab(
  studentId: string,
): Promise<ReportCardsTabResult> {
  if (!isSupabaseConfigured()) {
    return { rows: [], listError: "Supabase is not configured." };
  }
  const supabase = await createServerSupabaseClient();
  const { items, listError } = await loadReportCardsForStudent(
    supabase,
    studentId,
  );
  const rows: ReportCardSummary[] = items.map((it) => ({
    id: it.id,
    academicYear: it.schoolYear,
    termLabel: it.term,
    issuedOn: it.createdAt.slice(0, 10),
    status: it.status,
    headline: it.title?.trim() || "PDF report card",
  }));
  return { rows, listError };
}

export type ReportCardFileRow = Awaited<
  ReturnType<typeof loadReportCardsForStudent>
>["items"][number];

export async function loadReportCardFileRows(
  studentId: string,
): Promise<{ items: ReportCardFileRow[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { items: [], error: "Supabase is not configured." };
  }
  const supabase = await createServerSupabaseClient();
  return loadReportCardsForStudent(supabase, studentId).then((r) => ({
    items: r.items,
    error: r.listError,
  }));
}

type TransitionRow = {
  id: string;
  author_profile_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  academic_strengths: string;
  academic_needs: string;
  reading_notes: string;
  writing_notes: string;
  math_notes: string;
  english_language_notes: string;
  learning_habits: string;
  social_emotional_notes: string;
  successful_strategies: string;
  recommended_next_steps: string;
};

function normalizeTransitionStatus(raw: string): TransitionNoteStatus {
  if (
    raw === "draft" ||
    raw === "submitted" ||
    raw === "reviewed" ||
    raw === "archived" ||
    raw === "reopened"
  ) {
    return raw;
  }
  return "draft";
}

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

export type TransitionNotesResult =
  | { kind: "ok"; notes: TransitionNote[] }
  | { kind: "error"; message: string };

/** Whether the signed-in teacher may compose notes for this student (class_teachers / enrollments). */
export async function teacherCanAccessStudentForProfile(
  studentId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createServerSupabaseClient();
  return assertTeacherCanAccessStudent(supabase, studentId);
}

/**
 * Loads transition notes for the student profile tab.
 * Omits reviewed_at/archived_at so the tab works before migration
 * 20260514150000_transition_notes_workflow.sql is applied (apply that migration for moderation timestamps).
 */
export async function loadTransitionNotes(
  studentId: string,
): Promise<TransitionNotesResult> {
  if (!isSupabaseConfigured()) {
    return { kind: "error", message: "Supabase is not configured." };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("transition_notes")
    .select(
      "id, author_profile_id, status, created_at, updated_at, academic_strengths, academic_needs, reading_notes, writing_notes, math_notes, english_language_notes, learning_habits, social_emotional_notes, successful_strategies, recommended_next_steps",
    )
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { kind: "error", message: error.message };
  }

  const rows = (data ?? []) as TransitionRow[];
  const authorIds = [...new Set(rows.map((r) => r.author_profile_id))];
  const roleByAuthor = new Map<string, string>();

  if (authorIds.length > 0) {
    const { data: profs, error: profErr } = await supabase
      .from("profiles")
      .select("id, role")
      .in("id", authorIds);
    if (!profErr && profs) {
      for (const p of profs as { id: string; role: string }[]) {
        roleByAuthor.set(p.id, p.role);
      }
    }
  }

  const notes: TransitionNote[] = rows.map((row) => {
    const st = normalizeTransitionStatus(row.status);
    const ar = roleByAuthor.get(row.author_profile_id);
    const authorLabel =
      ar && isRole(ar) ? roleLabels[ar] : "Staff";
    return {
      id: row.id,
      title: `Transition note · ${row.updated_at.slice(0, 10)}`,
      authoredOn: row.created_at,
      updatedAt: row.updated_at,
      reviewedAt: null,
      archivedAt: null,
      authorName: `${authorLabel} · ${row.author_profile_id.slice(0, 8)}…`,
      status: st,
      summary: buildTransitionSummary(row),
    };
  });

  return { kind: "ok", notes };
}

export async function getTransitionNotes(
  studentId: string,
): Promise<TransitionNote[]> {
  const r = await loadTransitionNotes(studentId);
  return r.kind === "ok" ? r.notes : [];
}

export type AuditEventsResult =
  | { kind: "ok"; events: AuditEvent[] }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

export async function loadAuditEventsForStudent(
  studentId: string,
  viewerRole: Role,
): Promise<AuditEventsResult> {
  if (!canManageStudents(viewerRole)) {
    return { kind: "forbidden" };
  }
  if (!isSupabaseConfigured()) {
    return { kind: "error", message: "Supabase is not configured." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, action, actor_id, metadata, created_at")
    .contains("metadata", { studentId } as Record<string, unknown>)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return { kind: "error", message: error.message };
  }

  const events: AuditEvent[] = (data ?? []).map((row) => {
    const meta = row.metadata as Record<string, unknown> | null;
    const details =
      typeof meta?.["scopeSummary"] === "string"
        ? (meta["scopeSummary"] as string)
        : JSON.stringify(meta ?? {});
    return {
      id: row.id,
      occurredAt: row.created_at,
      actorName: row.actor_id
        ? `User ${(row.actor_id as string).slice(0, 8)}…`
        : "System",
      action: row.action,
      entityType: "audit",
      entityId: studentId,
      details,
    };
  });

  return { kind: "ok", events };
}

export async function getAuditEvents(
  studentId: string,
  viewerRole: Role,
): Promise<AuditEvent[]> {
  const r = await loadAuditEventsForStudent(studentId, viewerRole);
  return r.kind === "ok" ? r.events : [];
}

export type StudentFilesResult =
  | { kind: "ok"; files: StudentFile[] }
  | { kind: "error"; message: string };

export async function loadStudentFiles(
  studentId: string,
): Promise<StudentFilesResult> {
  const { items, error } = await loadReportCardFileRows(studentId);
  if (error) {
    return { kind: "error", message: error };
  }
  const files: StudentFile[] = items.map((it) => ({
    id: it.id,
    label: it.title?.trim() || `${it.schoolYear} · ${it.term}`,
    category: "other",
    uploadedOn: it.createdAt.slice(0, 10),
    uploadedBy: it.uploadedBy?.trim()
      ? `User ${it.uploadedBy.slice(0, 8)}…`
      : "—",
    storageKey: it.storagePath,
  }));
  return { kind: "ok", files };
}

export async function getStudentFiles(studentId: string): Promise<StudentFile[]> {
  const r = await loadStudentFiles(studentId);
  return r.kind === "ok" ? r.files : [];
}
