import "server-only";

import { changeStudentClassPlacement } from "@/features/students/change-student-class-placement";
import {
  inferCodeFromName,
  inferSortOrderFromName,
  normalizeGradeCode,
} from "@/features/classes/grade-level-helpers";
import { logServerError, safeUserFacingMessage } from "@/lib/errors/safe-user-message";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

import { findClassByLabel, findGradeByLabel, normalizeMatchKey } from "./match-helpers";
import type {
  RosterImportContext,
  RosterImportOptions,
  RosterPlannedRow,
} from "./types";

type Supabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type StructureEnsureResult = {
  context: RosterImportContext;
  gradesCreated: number;
  classesCreated: number;
  errors: string[];
};

function parseClassNameSection(classLabel: string): { name: string; section: string | null } {
  const raw = classLabel.trim();
  // Support "Name · Section" or "Name - Section"
  const parts = raw.split(/\s*[·|]\s*|\s+-\s+/);
  if (parts.length >= 2) {
    const name = parts[0]!.trim();
    const section = parts.slice(1).join(" · ").trim();
    return { name: name || raw, section: section || null };
  }
  return { name: raw, section: null };
}

async function ensureGrade(
  supabase: Supabase,
  context: RosterImportContext,
  gradeLabel: string,
): Promise<{ ok: true; gradeId: string; created: boolean } | { ok: false; message: string }> {
  const existing = findGradeByLabel(context.grades, gradeLabel);
  if (existing) return { ok: true, gradeId: existing.id, created: false };

  const name = gradeLabel.trim().slice(0, 200);
  let sortOrder = inferSortOrderFromName(name);
  if (sortOrder === null) {
    const max = context.grades.reduce((m, g) => Math.max(m, g.sortOrder), 0);
    sortOrder = max + 1;
  }
  // sort_order may be shared; only codes must stay unique when set.

  let code = normalizeGradeCode(inferCodeFromName(name));
  if (code) {
    const usedCodes = new Set(
      context.grades
        .map((g) => g.code?.trim().toLowerCase())
        .filter(Boolean) as string[],
    );
    if (usedCodes.has(code.toLowerCase())) {
      let suffix = 2;
      let candidate = `${code}-${suffix}`.slice(0, 40);
      while (usedCodes.has(candidate.toLowerCase())) {
        suffix += 1;
        candidate = `${code}-${suffix}`.slice(0, 40);
      }
      code = candidate;
    }
  }

  // Omit is_archived — column may be absent until grade-levels archive migration.
  const { data, error } = await supabase
    .from("grade_levels")
    .insert({
      name,
      sort_order: sortOrder,
      code,
    })
    .select("id, name, code, sort_order")
    .single();

  if (error || !data) {
    if (error) logServerError("roster-import.ensureGrade", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(
        error?.message,
        `Could not create grade "${name}".`,
      ),
    };
  }

  context.grades.push({
    id: data.id,
    name: data.name,
    code: data.code,
    sortOrder: data.sort_order,
    isArchived: false,
  });

  return { ok: true, gradeId: data.id, created: true };
}

async function ensureClass(
  supabase: Supabase,
  context: RosterImportContext,
  classLabel: string,
  gradeLabel: string | null,
  options: RosterImportOptions,
): Promise<{ ok: true; classId: string; created: boolean } | { ok: false; message: string }> {
  const existing = findClassByLabel(
    context.classes,
    classLabel,
    gradeLabel,
    context.schoolYearId,
  );
  if (existing) return { ok: true, classId: existing.id, created: false };

  if (!context.schoolYearId) {
    return {
      ok: false,
      message: "Set a current school year before auto-creating classes.",
    };
  }

  let gradeId: string | null = null;
  if (gradeLabel) {
    const found = findGradeByLabel(context.grades, gradeLabel);
    if (found) {
      gradeId = found.id;
    } else if (options.createMissingGrades) {
      const g = await ensureGrade(supabase, context, gradeLabel);
      if (!g.ok) return g;
      gradeId = g.gradeId;
    } else {
      return {
        ok: false,
        message: `Grade "${gradeLabel}" was not found for class "${classLabel}". Enable create missing grades, or add the grade first.`,
      };
    }
  } else {
    const active = context.grades.find((g) => !g.isArchived);
    if (!active) {
      return {
        ok: false,
        message: `Cannot create class "${classLabel}" without a grade. Add a Grade column or create a grade level first.`,
      };
    }
    gradeId = active.id;
  }

  const { name, section } = parseClassNameSection(classLabel);

  const { data, error } = await supabase
    .from("classes")
    .insert({
      school_year_id: context.schoolYearId,
      grade_level_id: gradeId,
      name: name.slice(0, 200),
      section: section ? section.slice(0, 80) : null,
      is_active: true,
    })
    .select("id, name, section, school_year_id, grade_level_id, is_active")
    .single();

  if (error || !data) {
    if (error) logServerError("roster-import.ensureClass", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(
        error?.message,
        `Could not create class "${classLabel}".`,
      ),
    };
  }

  const grade = context.grades.find((g) => g.id === gradeId);
  const gradeName = grade?.name ?? "—";
  const sec = data.section?.trim();
  const klass = sec ? `${data.name} · ${sec}` : data.name;

  context.classes.push({
    id: data.id,
    name: data.name,
    section: data.section,
    schoolYearId: data.school_year_id,
    gradeLevelId: data.grade_level_id,
    gradeName,
    gradeCode: grade?.code ?? null,
    label: `${gradeName} · ${klass}`,
    isActive: data.is_active !== false,
  });

  return { ok: true, classId: data.id, created: true };
}

/**
 * Optionally create missing grades/classes, then re-resolve class/grade IDs on planned rows.
 */
export async function ensureMissingStructure(
  supabase: Supabase,
  context: RosterImportContext,
  plannedRows: RosterPlannedRow[],
  options: RosterImportOptions,
): Promise<StructureEnsureResult> {
  let gradesCreated = 0;
  let classesCreated = 0;
  const errors: string[] = [];

  if (options.createMissingGrades) {
    const labels = new Set<string>();
    for (const row of plannedRows) {
      if (row.gradeLabel?.trim()) labels.add(row.gradeLabel.trim());
    }
    for (const label of labels) {
      if (findGradeByLabel(context.grades, label)) continue;
      const result = await ensureGrade(supabase, context, label);
      if (!result.ok) {
        errors.push(result.message);
      } else if (result.created) {
        gradesCreated += 1;
      }
    }
  }

  if (options.createMissingClasses) {
    const seen = new Set<string>();
    for (const row of plannedRows) {
      if (!row.classLabel.trim()) continue;
      if (row.classId) continue;
      const key = `${row.gradeLabel ?? ""}||${row.classLabel}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const result = await ensureClass(
        supabase,
        context,
        row.classLabel,
        row.gradeLabel,
        options,
      );
      if (!result.ok) {
        errors.push(result.message);
      } else if (result.created) {
        classesCreated += 1;
      }
    }
  }

  // Re-resolve IDs after structure changes.
  for (const row of plannedRows) {
    if (!row.classId && row.classLabel) {
      const matched = findClassByLabel(
        context.classes,
        row.classLabel,
        row.gradeLabel,
        context.schoolYearId,
      );
      if (matched) {
        row.classId = matched.id;
        row.gradeLevelId = matched.gradeLevelId;
        row.schoolYearId = matched.schoolYearId;
      }
    }
    if (!row.gradeLevelId && row.gradeLabel) {
      const g = findGradeByLabel(context.grades, row.gradeLabel);
      if (g) row.gradeLevelId = g.id;
    }
  }

  return { context, gradesCreated, classesCreated, errors };
}

export type ApplyRowResult =
  | { ok: true; action: "added" | "updated" | "skipped" }
  | { ok: false; message: string };

export async function applyPlannedRow(
  supabase: Supabase,
  row: RosterPlannedRow,
  options: RosterImportOptions,
): Promise<ApplyRowResult> {
  if (!row.firstName || !row.lastName) {
    return { ok: false, message: "Missing required name fields." };
  }
  if (!row.classId || !row.schoolYearId) {
    return { ok: false, message: `Class "${row.classLabel}" could not be resolved.` };
  }

  if (row.existingStudentId) {
    if (!options.updateExisting) {
      return { ok: true, action: "skipped" };
    }

    const { error: updErr } = await supabase
      .from("students")
      .update({
        first_name: row.firstName.slice(0, 120),
        last_name: row.lastName.slice(0, 120),
        preferred_name: row.preferredName,
        external_id: row.externalId,
      })
      .eq("id", row.existingStudentId);

    if (updErr) {
      logServerError("roster-import.applyPlannedRow.updateStudent", updErr.message);
      const msg =
        updErr.message.includes("students_external_id_unique") || updErr.code === "23505"
          ? "A student with this Student Number already exists."
          : safeUserFacingMessage(updErr.message, "Could not update this student.");
      return { ok: false, message: msg };
    }

    if (row.existingEnrollmentId) {
      if (row.existingClassId && row.existingClassId !== row.classId) {
        // Safe transfer: never rewrite class_id on the historical enrollment row.
        const transferred = await changeStudentClassPlacement(supabase, {
          enrollmentId: row.existingEnrollmentId,
          destinationClassId: row.classId,
        });
        if (!transferred.ok) {
          return {
            ok: false,
            message: transferred.message,
          };
        }
      } else {
        const { error: enErr } = await supabase
          .from("student_enrollments")
          .update({
            status: "active",
          })
          .eq("id", row.existingEnrollmentId);

        if (enErr) {
          logServerError("roster-import.applyPlannedRow.updateEnrollment", enErr.message);
          return {
            ok: false,
            message: safeUserFacingMessage(
              enErr.message,
              "Could not update this student's class enrollment.",
            ),
          };
        }
      }
    } else {
      const { error: enErr } = await supabase.from("student_enrollments").insert({
        student_id: row.existingStudentId,
        class_id: row.classId,
        school_year_id: row.schoolYearId,
        status: "active",
      });
      if (enErr) {
        logServerError("roster-import.applyPlannedRow.insertEnrollment", enErr.message);
        return {
          ok: false,
          message: safeUserFacingMessage(
            enErr.message,
            "Could not enroll this student in the class.",
          ),
        };
      }
    }

    return { ok: true, action: "updated" };
  }

  if (!options.createNew) {
    return { ok: true, action: "skipped" };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("students")
    .insert({
      first_name: row.firstName.slice(0, 120),
      last_name: row.lastName.slice(0, 120),
      preferred_name: row.preferredName,
      external_id: row.externalId,
    })
    .select("id")
    .single();

  if (insertErr || !inserted?.id) {
    if (insertErr) {
      logServerError("roster-import.applyPlannedRow.insertStudent", insertErr.message);
    }
    const msg =
      insertErr?.message.includes("students_external_id_unique") ||
      insertErr?.code === "23505"
        ? "A student with this Student Number already exists."
        : safeUserFacingMessage(insertErr?.message, "Could not create student.");
    return { ok: false, message: msg };
  }

  const { error: enErr } = await supabase.from("student_enrollments").insert({
    student_id: inserted.id,
    class_id: row.classId,
    school_year_id: row.schoolYearId,
    status: "active",
  });

  if (enErr) {
    logServerError("roster-import.applyPlannedRow.enrollNew", enErr.message);
    await supabase.from("students").delete().eq("id", inserted.id);
    return {
      ok: false,
      message: safeUserFacingMessage(enErr.message, "Could not enroll student."),
    };
  }

  return { ok: true, action: "added" };
}

export async function archiveLeavingStudents(
  supabase: Supabase,
  leaving: {
    studentId: string;
    enrollmentId: string;
  }[],
): Promise<{ archived: number; errors: { rowNumber: number; message: string }[] }> {
  let archived = 0;
  const errors: { rowNumber: number; message: string }[] = [];

  for (const row of leaving) {
    const { error } = await supabase
      .from("student_enrollments")
      .update({ status: "withdrawn" })
      .eq("id", row.enrollmentId);

    if (error) {
      logServerError("roster-import.archiveLeavingStudents", error.message);
      errors.push({
        rowNumber: 0,
        message: "Could not archive a withdrawn student's enrollment. Try again.",
      });
    } else {
      archived += 1;
    }
  }

  return { archived, errors };
}

export function refreshPlannedClassIds(
  plannedRows: RosterPlannedRow[],
  context: RosterImportContext,
): void {
  for (const row of plannedRows) {
    if (row.classId) continue;
    const matched = findClassByLabel(
      context.classes,
      row.classLabel,
      row.gradeLabel,
      context.schoolYearId,
    );
    if (matched) {
      row.classId = matched.id;
      row.gradeLevelId = matched.gradeLevelId;
      row.schoolYearId = matched.schoolYearId;
    }
  }
}

export { normalizeMatchKey };
