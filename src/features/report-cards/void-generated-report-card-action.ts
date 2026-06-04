"use server";

import { revalidatePath } from "next/cache";

import { canVoidGeneratedReportCard, isRole, type Role } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getReportCardStaff } from "@/lib/auth/report-card-upload-role";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/students/uuid";

export type VoidGeneratedReportCardState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

function sanitizeReason(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, 500);
}

export async function voidGeneratedReportCardAction(
  _prev: VoidGeneratedReportCardState | undefined,
  formData: FormData,
): Promise<VoidGeneratedReportCardState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: "Could not connect to the database." };
  }

  const staff = await getReportCardStaff(supabase);
  if (!staff || !isRole(staff.role) || !canVoidGeneratedReportCard(staff.role)) {
    return {
      ok: false,
      message: "Only school leadership can void generated report cards.",
    };
  }

  const roleRaw = String(formData.get("dashboardRole") ?? "");
  if (!isRole(roleRaw) || roleRaw !== staff.role) {
    return { ok: false, message: "Invalid workspace for this action." };
  }
  const dashboardRole = roleRaw as Role;

  const fileId = String(formData.get("fileId") ?? "");
  if (!isUuid(fileId)) {
    return { ok: false, message: "Invalid file id." };
  }

  const reason = sanitizeReason(String(formData.get("voidReason") ?? ""));
  if (!reason) {
    return { ok: false, message: "A reason is required to void this report card." };
  }

  const { data: row, error: loadError } = await supabase
    .from("report_card_files")
    .select("id, student_id, storage_path, source, voided_at, school_year, term")
    .eq("id", fileId)
    .maybeSingle();

  if (loadError || !row) {
    return { ok: false, message: "Report card file not found." };
  }

  if (row.source !== "generated") {
    return {
      ok: false,
      message: "Only generated report cards can be voided. Archive uploaded PDFs instead.",
    };
  }

  if (row.voided_at) {
    return { ok: false, message: "This report card is already voided." };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("report_card_files")
    .update({
      voided_at: now,
      voided_by: staff.userId,
      void_reason: reason,
    })
    .eq("id", fileId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  await recordAuditEvent({
    action: "report_card_voided",
    actorUserId: staff.userId,
    metadata: {
      fileId: row.id,
      studentId: row.student_id,
      storagePath: row.storage_path,
      schoolYear: row.school_year,
      term: row.term,
      reason,
    },
  });

  revalidatePath(`/dashboard/${dashboardRole}/report-cards`, "page");
  revalidatePath(
    `/dashboard/${dashboardRole}/students/${row.student_id}`,
    "layout",
  );
  revalidatePath(
    `/dashboard/${dashboardRole}/students/${row.student_id}/report-cards`,
    "page",
  );

  return { ok: true, message: "Report card voided. It remains in the audit history." };
}
