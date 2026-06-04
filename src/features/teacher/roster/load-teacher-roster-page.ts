import "server-only";

import { cache } from "react";

import { loadTeacherClassPageData } from "@/features/teacher/dashboard/load-teacher-workspace-data";

function classDisplayLabel(summary: {
  name: string;
  section: string | null;
  gradeName: string;
}): string {
  const sec = summary.section?.trim();
  const base = summary.name.trim() || "Class";
  const klass = sec ? `${base} · ${sec}` : base;
  return `${summary.gradeName} · ${klass}`;
}

export const loadTeacherRosterClassContext = cache(async (classId: string) => {
  const data = await loadTeacherClassPageData(classId);
  if (!data.ok) {
    return data;
  }
  return {
    ok: true as const,
    classId,
    classLabel: classDisplayLabel(data.classSummary),
    rosterHref: `/dashboard/teacher/classes/${classId}`,
    classSummary: data.classSummary,
  };
});

export const loadTeacherEditStudentModel = cache(
  async (
    studentId: string,
  ): Promise<
    | {
        ok: true;
        studentId: string;
        firstName: string;
        lastName: string;
        preferredName: string;
      }
    | { ok: false; kind: "not_found" | "forbidden"; message?: string }
  > => {
    const { requireTeacherCanAccessStudent } = await import(
      "@/lib/auth/teacher-class-access"
    );
    const gate = await requireTeacherCanAccessStudent(studentId);
    if (!gate.ok) {
      return { ok: false, kind: "forbidden", message: gate.message };
    }

    const { data, error } = await gate.supabase
      .from("students")
      .select("id, first_name, last_name, preferred_name")
      .eq("id", studentId)
      .maybeSingle();

    if (error) {
      return { ok: false, kind: "not_found", message: error.message };
    }
    if (!data) {
      return { ok: false, kind: "not_found" };
    }

    return {
      ok: true,
      studentId: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      preferredName: data.preferred_name?.trim() ?? "",
    };
  },
);
