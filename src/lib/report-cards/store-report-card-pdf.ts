import type { SupabaseClient } from "@supabase/supabase-js";

import { recordAuditEvent } from "@/lib/audit";
import { REPORT_CARDS_BUCKET } from "@/lib/report-cards/constants";
import type { ReportCardFileStatus } from "@/lib/report-cards/status";
import type { Database } from "@/types/database.types";

export type ReportCardFileSource = "uploaded" | "generated";

export type StoreReportCardPdfArgs = {
  supabase: SupabaseClient<Database>;
  studentId: string;
  schoolYear: string;
  term: string;
  storagePath: string;
  pdfBody: Buffer;
  title: string | null;
  status: ReportCardFileStatus;
  source: ReportCardFileSource;
  uploadedBy: string;
  auditAction: "report_card_uploaded" | "report_card_generated";
};

export type StoreReportCardPdfResult =
  | { ok: true; fileId: string }
  | { ok: false; message: string };

export function buildReportCardStoragePath(args: {
  studentId: string;
  schoolYear: string;
  term: string;
}): string {
  const objectId = crypto.randomUUID();
  return `${args.studentId}/${args.schoolYear}/${args.term}/${objectId}.pdf`;
}

export async function storeReportCardPdf(
  args: StoreReportCardPdfArgs,
): Promise<StoreReportCardPdfResult> {
  const { error: uploadError } = await args.supabase.storage
    .from(REPORT_CARDS_BUCKET)
    .upload(args.storagePath, args.pdfBody, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return {
      ok: false,
      message: uploadError.message || "Upload to storage failed.",
    };
  }

  const { data: insertedRow, error: insertError } = await args.supabase
    .from("report_card_files")
    .insert({
      student_id: args.studentId,
      school_year: args.schoolYear,
      term: args.term,
      storage_path: args.storagePath,
      title: args.title,
      status: args.status,
      source: args.source,
      uploaded_by: args.uploadedBy,
    })
    .select("id")
    .single();

  if (insertError) {
    await args.supabase.storage.from(REPORT_CARDS_BUCKET).remove([args.storagePath]);
    return {
      ok: false,
      message: insertError.message || "Could not save file metadata.",
    };
  }

  await recordAuditEvent({
    action: args.auditAction,
    actorUserId: args.uploadedBy,
    metadata: {
      studentId: args.studentId,
      storagePath: args.storagePath,
      fileId: insertedRow.id,
      source: args.source,
    },
  });

  return { ok: true, fileId: insertedRow.id };
}
