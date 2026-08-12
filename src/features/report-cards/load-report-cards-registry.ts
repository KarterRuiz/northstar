import type { SupabaseClient } from "@supabase/supabase-js";

import { logServerError } from "@/lib/errors/safe-user-message";
import {
  isReportCardFileStatus,
  type ReportCardFileStatus,
} from "@/lib/report-cards/status";
import { isUuid } from "@/lib/students/uuid";
import type { Database } from "@/types/database.types";

export const REPORT_CARD_LIBRARY_LOAD_ERROR =
  "We couldn't load report cards right now. Try again.";

export type ReportCardRegistryRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  schoolYear: string;
  term: string;
  title: string | null;
  status: ReportCardFileStatus;
  source: "uploaded" | "generated";
  voidedAt: string | null;
  voidReason: string | null;
  uploadedByName: string | null;
  createdAt: string;
};

type FileRow = {
  id: string;
  student_id: string;
  school_year: string;
  term: string;
  title: string | null;
  status: ReportCardFileStatus;
  source: string;
  voided_at: string | null;
  void_reason: string | null;
  uploaded_by: string | null;
  created_at: string;
};

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function loadActiveClassesForRegistry(
  supabase: SupabaseClient<Database>,
): Promise<{ options: { id: string; label: string }[]; error: string | null }> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, section")
    .eq("is_active", true)
    .order("name");

  if (error || !data) {
    logServerError(
      "report-cards.loadActiveClasses",
      error?.message ?? "Could not load classes.",
    );
    return { options: [], error: REPORT_CARD_LIBRARY_LOAD_ERROR };
  }

  const options = data.map((c) => ({
    id: c.id,
    label: [c.name, c.section?.trim() || null].filter(Boolean).join(" · "),
  }));

  return { options, error: null };
}

export async function loadReportCardsRegistry(
  supabase: SupabaseClient<Database>,
  filters: {
    schoolYear?: string | null;
    term?: string | null;
    status?: string | null;
    classId?: string | null;
    q?: string | null;
  },
): Promise<{ items: ReportCardRegistryRow[]; error: string | null }> {
  let studentIdIn: string[] | null = null;

  if (filters.classId && isUuid(filters.classId)) {
    const { data: en, error: enErr } = await supabase
      .from("student_enrollments")
      .select("student_id")
      .eq("class_id", filters.classId)
      .eq("status", "active");

    if (enErr) {
      logServerError("report-cards.registry.enrollments", enErr.message);
      return { items: [], error: REPORT_CARD_LIBRARY_LOAD_ERROR };
    }

    studentIdIn = [...new Set((en ?? []).map((r) => r.student_id))];
    if (studentIdIn.length === 0) {
      return { items: [], error: null };
    }
  }

  const qRaw = filters.q?.trim() ?? "";
  if (qRaw) {
    if (isUuid(qRaw)) {
      const narrowed = studentIdIn
        ? studentIdIn.filter((id) => id === qRaw)
        : [qRaw];
      studentIdIn = narrowed;
      if (studentIdIn.length === 0) {
        return { items: [], error: null };
      }
    } else {
      const token = escapeIlikePattern(qRaw);
      if (!token) {
        return { items: [], error: null };
      }
      const like = `%${token}%`;
      const { data: matches, error: searchErr } = await supabase
        .from("students")
        .select("id")
        .or(
          `first_name.ilike.${like},last_name.ilike.${like},preferred_name.ilike.${like},external_id.ilike.${like}`,
        )
        .limit(200);

      if (searchErr) {
        logServerError(
          "report-cards.registry.studentSearch",
          searchErr.message,
        );
        return { items: [], error: REPORT_CARD_LIBRARY_LOAD_ERROR };
      }
      const nameSet = new Set((matches ?? []).map((r) => r.id));
      if (nameSet.size === 0) {
        return { items: [], error: null };
      }
      studentIdIn = studentIdIn
        ? studentIdIn.filter((id) => nameSet.has(id))
        : [...nameSet];
      if (studentIdIn.length === 0) {
        return { items: [], error: null };
      }
    }
  }

  // Do not embed profiles via uploaded_by — that column references auth.users,
  // not public.profiles. PostgREST rejects `profiles:uploaded_by` (PGRST200)
  // and previously failed the whole library load.
  let query = supabase
    .from("report_card_files")
    .select(
      `
      id,
      student_id,
      school_year,
      term,
      title,
      status,
      source,
      voided_at,
      void_reason,
      uploaded_by,
      created_at
    `,
    )
    .order("created_at", { ascending: false })
    .limit(250);

  if (filters.schoolYear?.trim()) {
    query = query.eq("school_year", filters.schoolYear.trim());
  }
  if (filters.term?.trim()) {
    query = query.eq("term", filters.term.trim());
  }
  if (filters.status && isReportCardFileStatus(filters.status)) {
    query = query.eq("status", filters.status);
  }
  if (studentIdIn && studentIdIn.length > 0) {
    query = query.in("student_id", studentIdIn);
  }

  const { data, error } = await query;

  if (error || !data) {
    logServerError(
      "report-cards.registry.query",
      error?.message ?? "Could not load report cards.",
    );
    return { items: [], error: REPORT_CARD_LIBRARY_LOAD_ERROR };
  }

  const rows = data as FileRow[];
  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  const uploaderIds = [
    ...new Set(rows.map((r) => r.uploaded_by).filter((id): id is string => Boolean(id))),
  ];

  const [studentsRes, profilesRes] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from("students")
          .select("id, first_name, last_name, preferred_name, external_id")
          .in("id", studentIds)
      : Promise.resolve({ data: [] as const, error: null }),
    uploaderIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", uploaderIds)
      : Promise.resolve({ data: [] as const, error: null }),
  ]);

  if (studentsRes.error) {
    logServerError("report-cards.registry.students", studentsRes.error.message);
    return { items: [], error: REPORT_CARD_LIBRARY_LOAD_ERROR };
  }
  if (profilesRes.error) {
    logServerError("report-cards.registry.profiles", profilesRes.error.message);
  }

  const studentById = new Map(
    (studentsRes.data ?? []).map((s) => [s.id, s]),
  );
  const nameByUploader = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name?.trim() || null]),
  );

  const items: ReportCardRegistryRow[] = rows.map((row) => {
    const st = studentById.get(row.student_id);
    const pref = st?.preferred_name?.trim();
    const studentName = st
      ? pref || `${st.first_name} ${st.last_name}`.trim() || "Student"
      : "Student";
    return {
      id: row.id,
      studentId: row.student_id,
      studentName,
      studentNumber: st?.external_id?.trim() || null,
      schoolYear: row.school_year,
      term: row.term,
      title: row.title,
      status: row.status,
      source: row.source === "generated" ? "generated" : "uploaded",
      voidedAt: row.voided_at,
      voidReason: row.void_reason,
      uploadedByName: row.uploaded_by
        ? nameByUploader.get(row.uploaded_by) ?? null
        : null,
      createdAt: row.created_at,
    };
  });

  return { items, error: null };
}
