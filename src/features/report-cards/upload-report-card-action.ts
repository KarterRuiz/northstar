"use server";

/**
 * Report card PDF upload — Supabase Storage (`report-cards`) + `report_card_files` row.
 * See `supabase/migrations/20260514120000_report_cards_status_storage.sql` for RLS and storage policies.
 */

import { revalidatePath } from "next/cache";

import {
  assertTeacherCanAccessStudent,
  getReportCardStaff,
} from "@/lib/auth/report-card-upload-role";
import {
  isReportCardTerm,
  MAX_REPORT_CARD_BYTES,
} from "@/lib/report-cards/constants";
import {
  buildReportCardStoragePath,
  storeReportCardPdf,
} from "@/lib/report-cards/store-report-card-pdf";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStudentId } from "@/lib/students/uuid";
import { isRole, type Role } from "@/config/roles";

export type UploadReportCardState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

function isPdfMagic(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const head = new Uint8Array(buffer.slice(0, 4));
  return (
    head[0] === 0x25 &&
    head[1] === 0x50 &&
    head[2] === 0x44 &&
    head[3] === 0x46
  );
}

function sanitizeSegment(value: string, maxLen: number): string | null {
  const t = value.trim();
  if (!t || t.length > maxLen) return null;
  if (/[^a-zA-Z0-9._-]/.test(t)) return null;
  return t;
}

export async function uploadReportCardAction(
  _prev: UploadReportCardState | undefined,
  formData: FormData,
): Promise<UploadReportCardState> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured (missing public URL or anon key).",
    };
  }

  const staff = await getReportCardStaff(supabase);
  if (!staff) {
    return {
      ok: false,
      message:
        "You must be signed in with a role that may upload report cards.",
    };
  }

  const roleRaw = String(formData.get("dashboardRole") ?? "");
  if (!isRole(roleRaw)) {
    return { ok: false, message: "Invalid workspace for this action." };
  }
  const dashboardRole = roleRaw as Role;

  const allowedUploadRoles: Role[] = [
    "admin",
    "teacher",
    "registrar",
    "principal",
    "vice_principal",
  ];
  if (!allowedUploadRoles.includes(dashboardRole)) {
    return { ok: false, message: "This workspace cannot upload report cards." };
  }

  if (staff.role !== dashboardRole) {
    return { ok: false, message: "Session role does not match this workspace." };
  }

  const studentId = String(formData.get("studentId") ?? "");
  if (!isStudentId(studentId)) {
    return { ok: false, message: "Invalid student id." };
  }

  if (staff.role === "teacher") {
    const ok = await assertTeacherCanAccessStudent(supabase, studentId);
    if (!ok) {
      return {
        ok: false,
        message:
          "You can only upload report cards for students in your active classes.",
      };
    }
  }

  const schoolYearRaw = String(formData.get("schoolYear") ?? "");
  const schoolYear = sanitizeSegment(schoolYearRaw, 32);
  if (!schoolYear) {
    return {
      ok: false,
      message:
        "School year is required (letters, digits, dot, underscore, hyphen; max 32).",
    };
  }

  const term = String(formData.get("term") ?? "").trim();
  if (!isReportCardTerm(term)) {
    return { ok: false, message: "Pick a valid term (T1–T4)." };
  }

  const titleRaw = String(formData.get("title") ?? "").trim();
  const title = titleRaw.length === 0 ? null : titleRaw.slice(0, 200);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a PDF file to upload." };
  }

  if (file.size > MAX_REPORT_CARD_BYTES) {
    return {
      ok: false,
      message: `File is too large (max ${Math.floor(MAX_REPORT_CARD_BYTES / (1024 * 1024))} MB).`,
    };
  }

  const declaredType = (file.type || "").toLowerCase();
  if (
    declaredType !== "application/pdf" &&
    !declaredType.endsWith("/pdf")
  ) {
    return { ok: false, message: "Only PDF uploads are allowed." };
  }

  const buffer = await file.arrayBuffer();
  if (!isPdfMagic(buffer)) {
    return { ok: false, message: "This file does not look like a PDF." };
  }

  const storagePath = buildReportCardStoragePath({ studentId, schoolYear, term });
  const stored = await storeReportCardPdf({
    supabase,
    studentId,
    schoolYear,
    term,
    storagePath,
    pdfBody: Buffer.from(buffer),
    title,
    status: "draft",
    source: "uploaded",
    uploadedBy: staff.userId,
    auditAction: "report_card_uploaded",
  });

  if (!stored.ok) {
    return { ok: false, message: stored.message };
  }

  revalidatePath(
    `/dashboard/${dashboardRole}/students/${studentId}`,
    "layout",
  );
  revalidatePath(`/dashboard/${dashboardRole}/report-cards`, "page");

  return { ok: true, message: "Report card uploaded." };
}
