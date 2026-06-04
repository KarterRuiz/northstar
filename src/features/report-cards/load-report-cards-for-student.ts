import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReportCardFileStatus } from "@/lib/report-cards/status";
import type { Database } from "@/types/database.types";

export type ReportCardListItem = {
  id: string;
  schoolYear: string;
  term: string;
  title: string | null;
  storagePath: string;
  status: ReportCardFileStatus;
  source: "uploaded" | "generated";
  createdAt: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
};

type DbRow = {
  id: string;
  student_id: string;
  school_year: string;
  term: string;
  title: string | null;
  storage_path: string;
  status: ReportCardFileStatus;
  source: string;
  uploaded_by: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

function unwrapProfile(
  v: DbRow["profiles"],
): { full_name: string | null } | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function loadReportCardsForStudent(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<{ items: ReportCardListItem[]; listError: string | null }> {
  const { data: rows, error } = await supabase
    .from("report_card_files")
    .select(
      `
      id,
      student_id,
      school_year,
      term,
      title,
      storage_path,
      status,
      source,
      uploaded_by,
      created_at,
      voided_at,
      void_reason,
      profiles:uploaded_by ( full_name )
    `,
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error || !rows) {
    return { items: [], listError: error?.message ?? "Could not load files." };
  }

  const out: ReportCardListItem[] = (rows as unknown as DbRow[]).map((row) => {
    const profile = unwrapProfile(row.profiles);
    return {
      id: row.id,
      schoolYear: row.school_year,
      term: row.term,
      title: row.title,
      storagePath: row.storage_path,
      status: row.status,
      source: row.source === "generated" ? "generated" : "uploaded",
      createdAt: row.created_at,
      uploadedBy: row.uploaded_by,
      uploadedByName: profile?.full_name?.trim() || null,
      voidedAt: row.voided_at,
      voidReason: row.void_reason,
    };
  });

  return { items: out, listError: null };
}
