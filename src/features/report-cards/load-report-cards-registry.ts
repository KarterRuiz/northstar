import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isReportCardFileStatus,
  type ReportCardFileStatus,
} from "@/lib/report-cards/status";
import { isUuid } from "@/lib/students/uuid";
import type { Database } from "@/types/database.types";

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

type StudentEmbed = {
  first_name: string;
  last_name: string;
  external_id: string | null;
};

type ReportCardJoinRow = {
  id: string;
  student_id: string;
  school_year: string;
  term: string;
  title: string | null;
  status: ReportCardFileStatus;
  source: string;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  students: StudentEmbed | StudentEmbed[] | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

export async function loadActiveClassesForRegistry(
  supabase: SupabaseClient<Database>,
): Promise<{ options: { id: string; label: string }[]; error: string | null }> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, section")
    .eq("is_active", true)
    .order("name");

  if (error || !data) {
    return { options: [], error: error?.message ?? "Could not load classes." };
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
      return { items: [], error: enErr.message };
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
      const token = qRaw.replace(/[%_\\]/g, " ").trim();
      if (!token) {
        return { items: [], error: null };
      }
      const like = `%${token}%`;
      const [{ data: s1, error: e1 }, { data: s2, error: e2 }] =
        await Promise.all([
          supabase.from("students").select("id").ilike("first_name", like),
          supabase.from("students").select("id").ilike("last_name", like),
        ]);
      if (e1 || e2) {
        return {
          items: [],
          error: e1?.message ?? e2?.message ?? "Student search failed.",
        };
      }
      const nameSet = new Set(
        [...(s1 ?? []), ...(s2 ?? [])].map((r) => r.id),
      );
      const nameIds = [...nameSet];
      if (nameIds.length === 0) {
        return { items: [], error: null };
      }
      studentIdIn = studentIdIn
        ? studentIdIn.filter((id) => nameSet.has(id))
        : nameIds;
      if (studentIdIn.length === 0) {
        return { items: [], error: null };
      }
    }
  }

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
      created_at,
      students ( first_name, last_name, external_id ),
      profiles:uploaded_by ( full_name )
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
    return { items: [], error: error?.message ?? "Could not load report cards." };
  }

  const items: ReportCardRegistryRow[] = (data as unknown as ReportCardJoinRow[]).map(
    (row) => {
      const s = row.students;
      const st = Array.isArray(s) ? s[0] : s;
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const studentName = st
        ? `${st.first_name} ${st.last_name}`.trim()
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
        uploadedByName: profile?.full_name?.trim() || null,
        createdAt: row.created_at,
      };
    },
  );

  return { items, error: null };
}
