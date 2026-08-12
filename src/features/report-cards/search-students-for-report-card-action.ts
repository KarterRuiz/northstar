"use server";

import { canUploadReportCards, isRole } from "@/config/roles";
import { getReportCardStaff } from "@/lib/auth/report-card-upload-role";
import { logServerError } from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ReportCardStudentOption = {
  id: string;
  name: string;
  classLabel: string | null;
  gradeLabel: string | null;
  studentNumber: string | null;
};

export type SearchReportCardStudentsResult =
  | { ok: true; students: ReportCardStudentOption[] }
  | { ok: false; message: string };

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function displayName(row: {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
}): string {
  const pref = row.preferred_name?.trim();
  if (pref) return pref;
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Student";
}

function formatClassLabel(name: string, section: string | null): string {
  const base = name.trim() || "Class";
  const sec = section?.trim();
  return sec ? `${base} · ${sec}` : base;
}

export async function searchStudentsForReportCardAction(
  rawQuery: string,
): Promise<SearchReportCardStudentsResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Student search is unavailable right now." };
  }

  const supabase = await createServerSupabaseClient();
  const staff = await getReportCardStaff(supabase);
  if (!staff || !isRole(staff.role) || !canUploadReportCards(staff.role)) {
    return { ok: false, message: "You cannot search students for report cards." };
  }

  const q = rawQuery.trim().slice(0, 160);
  if (q.length < 2) {
    return { ok: true, students: [] };
  }

  const esc = escapeIlikePattern(q);
  const like = `%${esc}%`;

  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, preferred_name, external_id")
    .or(
      `first_name.ilike.${like},last_name.ilike.${like},preferred_name.ilike.${like},external_id.ilike.${like}`,
    )
    .limit(25);

  if (error) {
    logServerError("report-cards.studentSearch", error.message);
    return { ok: false, message: "We couldn't search students right now. Try again." };
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return { ok: true, students: [] };
  }

  const ids = rows.map((r) => r.id);
  const enrollmentsRes = await supabase
    .from("student_enrollments")
    .select("student_id, class_id")
    .in("student_id", ids)
    .eq("status", "active");

  if (enrollmentsRes.error) {
    logServerError(
      "report-cards.studentSearch.enrollments",
      enrollmentsRes.error.message,
    );
  }

  const classIds = [
    ...new Set((enrollmentsRes.data ?? []).map((e) => e.class_id)),
  ];
  const classesRes =
    classIds.length > 0
      ? await supabase
          .from("classes")
          .select("id, name, section, grade_level_id")
          .in("id", classIds)
      : { data: [] as const, error: null };

  if (classesRes.error) {
    logServerError("report-cards.studentSearch.classes", classesRes.error.message);
  }

  const gradeIds = [
    ...new Set(
      (classesRes.data ?? [])
        .map((c) => c.grade_level_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const gradesRes =
    gradeIds.length > 0
      ? await supabase.from("grade_levels").select("id, name").in("id", gradeIds)
      : { data: [] as const, error: null };

  const classById = new Map((classesRes.data ?? []).map((c) => [c.id, c]));
  const gradeById = new Map(
    (gradesRes.data ?? []).map((g) => [g.id, g.name?.trim() || null]),
  );
  const classByStudent = new Map<string, { classLabel: string; gradeLabel: string | null }>();
  for (const en of enrollmentsRes.data ?? []) {
    const klass = classById.get(en.class_id);
    if (!klass) continue;
    const next = {
      classLabel: formatClassLabel(klass.name, klass.section),
      gradeLabel: gradeById.get(klass.grade_level_id) ?? null,
    };
    const prev = classByStudent.get(en.student_id);
    if (!prev || next.classLabel.localeCompare(prev.classLabel) < 0) {
      classByStudent.set(en.student_id, next);
    }
  }

  const students: ReportCardStudentOption[] = rows.map((row) => {
    const placement = classByStudent.get(row.id);
    return {
      id: row.id,
      name: displayName(row),
      classLabel: placement?.classLabel ?? null,
      gradeLabel: placement?.gradeLabel ?? null,
      studentNumber: row.external_id?.trim() || null,
    };
  });

  return { ok: true, students };
}
