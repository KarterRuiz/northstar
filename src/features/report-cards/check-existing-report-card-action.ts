"use server";

import { canUploadReportCards, isRole } from "@/config/roles";
import {
  assertTeacherCanAccessStudent,
  getReportCardStaff,
} from "@/lib/auth/report-card-upload-role";
import { logServerError } from "@/lib/errors/safe-user-message";
import { isReportCardTerm } from "@/lib/report-cards/constants";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStudentId } from "@/lib/students/uuid";

export type ExistingReportCardMatch = {
  id: string;
  status: "draft" | "final" | "archive";
  title: string | null;
};

export type CheckExistingReportCardResult =
  | { ok: true; existing: ExistingReportCardMatch | null }
  | { ok: false; message: string };

export async function checkExistingReportCardAction(args: {
  studentId: string;
  schoolYear: string;
  term: string;
}): Promise<CheckExistingReportCardResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Report cards are unavailable right now." };
  }

  const supabase = await createServerSupabaseClient();
  const staff = await getReportCardStaff(supabase);
  if (!staff || !isRole(staff.role) || !canUploadReportCards(staff.role)) {
    return { ok: false, message: "You cannot check report cards for this student." };
  }

  if (!isStudentId(args.studentId)) {
    return { ok: false, message: "Choose a student first." };
  }
  if (staff.role === "teacher") {
    const allowed = await assertTeacherCanAccessStudent(supabase, args.studentId);
    if (!allowed) {
      return {
        ok: false,
        message: "You can only manage report cards for students in your classes.",
      };
    }
  }

  const schoolYear = args.schoolYear.trim();
  if (!schoolYear) {
    return { ok: true, existing: null };
  }
  if (!isReportCardTerm(args.term.trim())) {
    return { ok: true, existing: null };
  }

  const { data, error } = await supabase
    .from("report_card_files")
    .select("id, status, title, updated_at")
    .eq("student_id", args.studentId)
    .eq("school_year", schoolYear)
    .eq("term", args.term.trim())
    .is("voided_at", null)
    .neq("status", "archive")
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error) {
    logServerError("report-cards.checkExisting", error.message);
    return { ok: false, message: "We couldn't check for an existing report. Try again." };
  }

  const preferred =
    (data ?? []).find((row) => row.status === "final") ?? (data ?? [])[0] ?? null;

  return {
    ok: true,
    existing: preferred
      ? {
          id: preferred.id,
          status: preferred.status,
          title: preferred.title,
        }
      : null,
  };
}
