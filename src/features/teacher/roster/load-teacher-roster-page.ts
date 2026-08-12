import "server-only";

import { cache } from "react";

import { loadTeacherClassContext } from "@/features/teacher/class-workspace/load-teacher-class-context";

export const loadTeacherRosterClassContext = cache(async (classId: string) => {
  const data = await loadTeacherClassContext(classId);
  if (!data.ok) {
    return data;
  }
  return {
    ok: true as const,
    classId,
    classLabel: `${data.context.gradeName} · ${data.context.title}`,
    rosterHref: `/dashboard/teacher/classes/${classId}/students`,
    classSummary: data.context,
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
