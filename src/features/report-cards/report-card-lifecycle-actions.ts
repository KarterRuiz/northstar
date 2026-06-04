"use server";

import { revalidatePath } from "next/cache";

import { canManageReportCardLifecycle, isRole, type Role } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getReportCardStaff } from "@/lib/auth/report-card-upload-role";
import {
  isReportCardFileStatus,
  type ReportCardFileStatus,
} from "@/lib/report-cards/status";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/students/uuid";

/** @deprecated Use void-returning `updateReportCardFileStatusAction` with `useActionState` if UI feedback is needed. */
export type ReportCardLifecycleState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

export async function updateReportCardFileStatusAction(
  formData: FormData,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = await createServerSupabaseClient();

  const staff = await getReportCardStaff(supabase);
  if (!staff || !isRole(staff.role) || !canManageReportCardLifecycle(staff.role)) {
    return;
  }

  const roleRaw = String(formData.get("dashboardRole") ?? "");
  if (!isRole(roleRaw) || roleRaw !== staff.role) {
    return;
  }
  const dashboardRole = roleRaw as Role;

  const fileId = String(formData.get("fileId") ?? "");
  if (!isUuid(fileId)) {
    return;
  }

  const nextRaw = String(formData.get("nextStatus") ?? "");
  if (!isReportCardFileStatus(nextRaw)) {
    return;
  }
  const nextStatus: ReportCardFileStatus = nextRaw;

  const { data: row, error: loadError } = await supabase
    .from("report_card_files")
    .select("id, student_id, storage_path, status")
    .eq("id", fileId)
    .maybeSingle();

  if (loadError || !row) {
    return;
  }

  if (row.status === nextStatus) {
    return;
  }

  const { error: updateError } = await supabase
    .from("report_card_files")
    .update({ status: nextStatus })
    .eq("id", fileId);

  if (updateError) {
    return;
  }

  if (nextStatus === "archive" && row.status !== "archive") {
    await recordAuditEvent({
      action: "report_card_archived",
      actorUserId: staff.userId,
      metadata: {
        fileId: row.id,
        studentId: row.student_id,
        storagePath: row.storage_path,
      },
    });
  }

  revalidatePath(`/dashboard/${dashboardRole}/report-cards`, "page");
  revalidatePath(
    `/dashboard/${dashboardRole}/students/${row.student_id}`,
    "layout",
  );
}
