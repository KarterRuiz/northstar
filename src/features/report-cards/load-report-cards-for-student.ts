import type { SupabaseClient } from "@supabase/supabase-js";

import { logServerError } from "@/lib/errors/safe-user-message";
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

const LIST_LOAD_ERROR = "We couldn't load report cards right now. Try again.";

export async function loadReportCardsForStudent(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<{ items: ReportCardListItem[]; listError: string | null }> {
  // uploaded_by references auth.users, not profiles — do not embed profiles.
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
      void_reason
    `,
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error || !rows) {
    logServerError(
      "report-cards.studentList",
      error?.message ?? "Could not load files.",
    );
    return { items: [], listError: LIST_LOAD_ERROR };
  }

  const uploaderIds = [
    ...new Set(
      rows.map((r) => r.uploaded_by).filter((id): id is string => Boolean(id)),
    ),
  ];
  const nameByUploader = new Map<string, string>();
  if (uploaderIds.length > 0) {
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", uploaderIds);
    if (profileErr) {
      logServerError("report-cards.studentList.profiles", profileErr.message);
    } else {
      for (const p of profiles ?? []) {
        const name = p.full_name?.trim();
        if (name) nameByUploader.set(p.id, name);
      }
    }
  }

  const out: ReportCardListItem[] = rows.map((row) => ({
    id: row.id,
    schoolYear: row.school_year,
    term: row.term,
    title: row.title,
    storagePath: row.storage_path,
    status: row.status,
    source: row.source === "generated" ? "generated" : "uploaded",
    createdAt: row.created_at,
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by
      ? nameByUploader.get(row.uploaded_by) ?? null
      : null,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
  }));

  return { items: out, listError: null };
}
