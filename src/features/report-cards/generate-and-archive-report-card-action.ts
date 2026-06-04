"use server";

/**
 * Generates a report card PDF server-side (Puppeteer) and archives to storage + report_card_files.
 */

import { revalidatePath } from "next/cache";

import {
  assertTeacherCanAccessStudent,
  getReportCardStaff,
} from "@/lib/auth/report-card-upload-role";
import {
  isReportCardTerm,
  MAX_REPORT_CARD_BYTES,
  REPORT_CARDS_BUCKET,
} from "@/lib/report-cards/constants";
import { generateReportCardPdfBuffer } from "@/lib/report-cards/generate-report-card-pdf";
import {
  buildReportCardStoragePath,
  storeReportCardPdf,
} from "@/lib/report-cards/store-report-card-pdf";
import { requireTeacherAssignedToClass } from "@/lib/auth/teacher-class-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStudentId } from "@/lib/students/uuid";
import { isRole, type Role } from "@/config/roles";
import { isUuid } from "@/lib/students/uuid";

import { loadReportCardPreviewData } from "./load-report-card-workspace-data";

const SIGNED_URL_TTL_SEC = 60 * 60;

export type GenerateAndArchiveReportCardState =
  | { ok: true; message?: string; fileId?: string; signedUrl?: string }
  | { ok: false; message: string };

function sanitizeSchoolYear(value: string): string | null {
  const t = value.trim();
  if (!t || t.length > 32) return null;
  if (/[^a-zA-Z0-9._-]/.test(t)) return null;
  return t;
}

export async function generateAndArchiveReportCard(
  _prev: GenerateAndArchiveReportCardState | undefined,
  formData: FormData,
): Promise<GenerateAndArchiveReportCardState> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured (missing public URL or anon key).",
    };
  }

  const staff = await getReportCardStaff(supabase);
  if (!staff || staff.role !== "teacher") {
    return {
      ok: false,
      message: "You must be signed in as a teacher to generate report cards.",
    };
  }

  const roleRaw = String(formData.get("dashboardRole") ?? "");
  if (!isRole(roleRaw) || roleRaw !== "teacher") {
    return { ok: false, message: "Invalid workspace for this action." };
  }
  const dashboardRole = roleRaw as Role;

  const studentId = String(formData.get("studentId") ?? "");
  const classId = String(formData.get("classId") ?? "");
  if (!isStudentId(studentId) || !isUuid(classId)) {
    return { ok: false, message: "Invalid student or class." };
  }

  const term = String(formData.get("term") ?? "").trim();
  if (!isReportCardTerm(term)) {
    return { ok: false, message: "Pick a valid term (T1–T4)." };
  }

  const schoolYear = sanitizeSchoolYear(String(formData.get("schoolYear") ?? ""));
  if (!schoolYear) {
    return { ok: false, message: "School year is required." };
  }

  const preview = await loadReportCardPreviewData({ classId, studentId, term });
  if (!preview.ok) {
    return { ok: false, message: preview.message };
  }

  if (schoolYear !== preview.data.schoolYearLabel) {
    return { ok: false, message: "School year does not match this class." };
  }

  const gate = await requireTeacherAssignedToClass(classId);
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }

  const canAccess = await assertTeacherCanAccessStudent(supabase, studentId);
  if (!canAccess) {
    return {
      ok: false,
      message: "You can only generate report cards for students in your active classes.",
    };
  }

  let pdfBody: Buffer;
  try {
    pdfBody = await generateReportCardPdfBuffer(preview.data);
  } catch {
    return {
      ok: false,
      message: "Could not generate PDF. Try again or use Print / Save as PDF.",
    };
  }

  if (pdfBody.byteLength > MAX_REPORT_CARD_BYTES) {
    return {
      ok: false,
      message: `Generated PDF is too large (max ${Math.floor(MAX_REPORT_CARD_BYTES / (1024 * 1024))} MB).`,
    };
  }

  const storagePath = buildReportCardStoragePath({ studentId, schoolYear, term });
  const title = `Report card · ${term} · ${preview.data.studentDisplayName}`.slice(
    0,
    200,
  );

  const stored = await storeReportCardPdf({
    supabase,
    studentId,
    schoolYear,
    term,
    storagePath,
    pdfBody,
    title,
    status: "final",
    source: "generated",
    uploadedBy: staff.userId,
    auditAction: "report_card_generated",
  });

  if (!stored.ok) {
    return { ok: false, message: stored.message };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(REPORT_CARDS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);

  revalidatePath(`/dashboard/${dashboardRole}/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/${dashboardRole}/report-cards`, "page");
  revalidatePath(
    `/dashboard/${dashboardRole}/report-cards/preview/${studentId}`,
    "page",
  );

  return {
    ok: true,
    message: "Report card saved to the student record.",
    fileId: stored.fileId,
    signedUrl: signError ? undefined : signed?.signedUrl,
  };
}
