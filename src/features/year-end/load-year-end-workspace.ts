import "server-only";

import { canManageSchoolStructure, type Role } from "@/config/roles";
import { OPERATIONAL_ACTIVE_ENROLLMENT_STATUS } from "@/features/students/active-student-enrollments";
import { logServerError } from "@/lib/errors/safe-user-message";
import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
import { missingStandardTermCodes } from "@/lib/school-years/school-year-integrity";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  canMarkPlanReady,
  collectPreviewBlockers,
  summarizePreview,
  type PreviewCounts,
  type PreviewItemInput,
} from "./preview-validation";
import type {
  ClassRef,
  GradeLevelRef,
  YearEndBlocker,
  YearEndDisposition,
  YearEndPlanStatus,
  YearEndStep,
} from "./types";
import { YEAR_END_STEPS } from "./types";

export type YearEndSchoolYearOption = {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
  archived_at: string | null;
};

export type YearEndClassOption = ClassRef & {
  gradeName: string;
  gradeCode: string | null;
  label: string;
};

export type YearEndClassMapRow = {
  id: string;
  fromClassId: string;
  toClassId: string | null;
  fromClass: YearEndClassOption;
  toClass: YearEndClassOption | null;
};

export type YearEndPlanItemRow = {
  id: string;
  studentId: string;
  studentNumber: string | null;
  studentName: string;
  sourceEnrollmentId: string;
  sourceClassId: string;
  sourceClassLabel: string;
  sourceGradeName: string;
  disposition: YearEndDisposition;
  destinationClassId: string | null;
  destinationClassLabel: string | null;
  destinationGradeLevelId: string | null;
  reason: string | null;
};

export type YearEndPlanSummary = {
  id: string;
  status: YearEndPlanStatus;
  fromSchoolYearId: string;
  toSchoolYearId: string;
  fromLabel: string;
  toLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type YearEndWorkspaceData =
  | { ok: false; message: string }
  | {
      ok: true;
      step: YearEndStep;
      currentYearId: string | null;
      schoolYears: YearEndSchoolYearOption[];
      gradeLevels: GradeLevelRef[];
      plans: YearEndPlanSummary[];
      plan: YearEndPlanSummary | null;
      fromClasses: YearEndClassOption[];
      toClasses: YearEndClassOption[];
      classMaps: YearEndClassMapRow[];
      items: YearEndPlanItemRow[];
      toYearTermCodes: string[];
      missingToYearTerms: string[];
      blockers: YearEndBlocker[];
      counts: PreviewCounts;
      readyEligible: boolean;
    };

function parseStep(raw: string | undefined): YearEndStep {
  if (raw && (YEAR_END_STEPS as readonly string[]).includes(raw)) {
    return raw as YearEndStep;
  }
  return "setup";
}

function classLabel(
  c: Pick<ClassRef, "name" | "section">,
  gradeName: string,
): string {
  const section = (c.section ?? "").trim();
  const base = section ? `${c.name} (${section})` : c.name;
  return `${gradeName} · ${base}`;
}

export async function loadYearEndWorkspace(
  role: Role,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<YearEndWorkspaceData> {
  if (!canManageSchoolStructure(role)) {
    return { ok: false, message: "You do not have permission to open Year-End." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const stepRaw = Array.isArray(searchParams.step)
    ? searchParams.step[0]
    : searchParams.step;
  const planRaw = Array.isArray(searchParams.plan)
    ? searchParams.plan[0]
    : searchParams.plan;
  const step = parseStep(stepRaw);

  const supabase = await createServerSupabaseClient();
  const currentRes = await loadCurrentSchoolYear(supabase);
  const currentYearId = currentRes.ok ? (currentRes.year?.id ?? null) : null;

  const { data: years, error: yearsErr } = await supabase
    .from("school_years")
    .select("id, label, starts_on, ends_on, is_current, archived_at")
    .order("starts_on", { ascending: false });

  if (yearsErr) {
    logServerError("year-end.load.years", yearsErr.message);
    return { ok: false, message: "Could not load school years." };
  }

  const schoolYears = (years ?? []) as YearEndSchoolYearOption[];

  const { data: grades, error: gradesErr } = await supabase
    .from("grade_levels")
    .select("id, name, code, sort_order, is_archived")
    .order("sort_order", { ascending: true });

  if (gradesErr) {
    logServerError("year-end.load.grades", gradesErr.message);
    return { ok: false, message: "Could not load grade levels." };
  }

  const gradeLevels = (grades ?? []) as GradeLevelRef[];
  const gradesById = new Map(gradeLevels.map((g) => [g.id, g]));

  const { data: planRows, error: plansErr } = await supabase
    .from("year_end_plans")
    .select(
      "id, status, from_school_year_id, to_school_year_id, created_at, updated_at",
    )
    .in("status", ["draft", "ready"])
    .order("updated_at", { ascending: false });

  if (plansErr) {
    // Table may not exist yet before migration — surface a clear message.
    logServerError("year-end.load.plans", plansErr.message);
    const missing =
      plansErr.message.toLowerCase().includes("year_end_plans") ||
      plansErr.code === "42P01" ||
      plansErr.message.toLowerCase().includes("does not exist");
    return {
      ok: false,
      message: missing
        ? "Year-End tables are not applied yet. Apply migration 20260914010000_year_end_plans.sql before using this workspace."
        : "Could not load year-end plans.",
    };
  }

  const yearsById = new Map(schoolYears.map((y) => [y.id, y]));
  const plans: YearEndPlanSummary[] = (planRows ?? []).map((p) => ({
    id: p.id,
    status: p.status as YearEndPlanStatus,
    fromSchoolYearId: p.from_school_year_id,
    toSchoolYearId: p.to_school_year_id,
    fromLabel: yearsById.get(p.from_school_year_id)?.label ?? "Unknown",
    toLabel: yearsById.get(p.to_school_year_id)?.label ?? "Unknown",
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));

  let plan =
    (planRaw ? plans.find((p) => p.id === planRaw) : null) ?? plans[0] ?? null;

  // If plan id in URL but not in draft/ready list, try load once.
  if (planRaw && !plan) {
    const { data: one } = await supabase
      .from("year_end_plans")
      .select(
        "id, status, from_school_year_id, to_school_year_id, created_at, updated_at",
      )
      .eq("id", planRaw)
      .maybeSingle();
    if (one) {
      plan = {
        id: one.id,
        status: one.status as YearEndPlanStatus,
        fromSchoolYearId: one.from_school_year_id,
        toSchoolYearId: one.to_school_year_id,
        fromLabel: yearsById.get(one.from_school_year_id)?.label ?? "Unknown",
        toLabel: yearsById.get(one.to_school_year_id)?.label ?? "Unknown",
        createdAt: one.created_at,
        updatedAt: one.updated_at,
      };
    }
  }

  const emptyCounts = summarizePreview([], []);
  if (!plan) {
    return {
      ok: true,
      step,
      currentYearId,
      schoolYears,
      gradeLevels,
      plans,
      plan: null,
      fromClasses: [],
      toClasses: [],
      classMaps: [],
      items: [],
      toYearTermCodes: [],
      missingToYearTerms: [],
      blockers: [],
      counts: emptyCounts,
      readyEligible: false,
    };
  }

  const { data: fromClassRows } = await supabase
    .from("classes")
    .select("id, school_year_id, grade_level_id, name, section, is_active")
    .eq("school_year_id", plan.fromSchoolYearId)
    .order("name", { ascending: true });

  const { data: toClassRows } = await supabase
    .from("classes")
    .select("id, school_year_id, grade_level_id, name, section, is_active")
    .eq("school_year_id", plan.toSchoolYearId)
    .order("name", { ascending: true });

  const toClassOption = (c: ClassRef): YearEndClassOption => {
    const g = gradesById.get(c.grade_level_id);
    const gradeName = g?.name ?? "Grade";
    return {
      ...c,
      gradeName,
      gradeCode: g?.code ?? null,
      label: classLabel(c, gradeName),
    };
  };

  const fromClasses = ((fromClassRows ?? []) as ClassRef[])
    .filter((c) => c.is_active)
    .map(toClassOption);
  const toClasses = ((toClassRows ?? []) as ClassRef[])
    .filter((c) => c.is_active)
    .map(toClassOption);
  const fromById = new Map(fromClasses.map((c) => [c.id, c]));
  const allToById = new Map(
    ((toClassRows ?? []) as ClassRef[]).map((c) => [c.id, toClassOption(c)]),
  );

  const { data: mapRows } = await supabase
    .from("year_end_class_maps")
    .select("id, from_class_id, to_class_id")
    .eq("plan_id", plan.id);

  const classMaps: YearEndClassMapRow[] = (mapRows ?? [])
    .map((m) => {
      const fromClass = fromById.get(m.from_class_id);
      if (!fromClass) return null;
      return {
        id: m.id,
        fromClassId: m.from_class_id,
        toClassId: m.to_class_id,
        fromClass,
        toClass: m.to_class_id ? (allToById.get(m.to_class_id) ?? null) : null,
      };
    })
    .filter((m): m is YearEndClassMapRow => m != null);

  // Ensure every active from class appears in the map UI even without a row.
  for (const fc of fromClasses) {
    if (!classMaps.some((m) => m.fromClassId === fc.id)) {
      classMaps.push({
        id: `virtual-${fc.id}`,
        fromClassId: fc.id,
        toClassId: null,
        fromClass: fc,
        toClass: null,
      });
    }
  }
  classMaps.sort((a, b) => a.fromClass.label.localeCompare(b.fromClass.label));

  const { data: termRows } = await supabase
    .from("terms")
    .select("code")
    .eq("school_year_id", plan.toSchoolYearId);
  const toYearTermCodes = (termRows ?? []).map((t) => t.code);
  const missingToYearTerms = missingStandardTermCodes(toYearTermCodes);

  const { data: itemRows, error: itemsErr } = await supabase
    .from("year_end_plan_items")
    .select(
      `
      id,
      student_id,
      source_enrollment_id,
      disposition,
      destination_class_id,
      destination_grade_level_id,
      reason,
      students!inner (
        id,
        external_id,
        first_name,
        last_name,
        preferred_name
      ),
      student_enrollments!inner (
        id,
        class_id,
        classes!inner (
          id,
          name,
          section,
          grade_level_id
        )
      )
    `,
    )
    .eq("plan_id", plan.id);

  if (itemsErr) {
    logServerError("year-end.load.items", itemsErr.message);
  }

  type RawItem = {
    id: string;
    student_id: string;
    source_enrollment_id: string;
    disposition: string;
    destination_class_id: string | null;
    destination_grade_level_id: string | null;
    reason: string | null;
    students:
      | {
          id: string;
          external_id: string | null;
          first_name: string;
          last_name: string;
          preferred_name: string | null;
        }
      | {
          id: string;
          external_id: string | null;
          first_name: string;
          last_name: string;
          preferred_name: string | null;
        }[];
    student_enrollments:
      | {
          id: string;
          class_id: string;
          classes:
            | {
                id: string;
                name: string;
                section: string | null;
                grade_level_id: string;
              }
            | {
                id: string;
                name: string;
                section: string | null;
                grade_level_id: string;
              }[];
        }
      | {
          id: string;
          class_id: string;
          classes:
            | {
                id: string;
                name: string;
                section: string | null;
                grade_level_id: string;
              }
            | {
                id: string;
                name: string;
                section: string | null;
                grade_level_id: string;
              }[];
        }[];
  };

  const items: YearEndPlanItemRow[] = ((itemRows ?? []) as unknown as RawItem[]).map(
    (row) => {
      const stu = Array.isArray(row.students) ? row.students[0]! : row.students;
      const enr = Array.isArray(row.student_enrollments)
        ? row.student_enrollments[0]!
        : row.student_enrollments;
      const cls = Array.isArray(enr.classes) ? enr.classes[0]! : enr.classes;
      const grade = gradesById.get(cls.grade_level_id);
      const displayName =
        (stu.preferred_name ?? "").trim() ||
        `${stu.first_name} ${stu.last_name}`.trim();
      const dest = row.destination_class_id
        ? allToById.get(row.destination_class_id) ?? null
        : null;
      return {
        id: row.id,
        studentId: row.student_id,
        studentNumber: stu.external_id,
        studentName: displayName,
        sourceEnrollmentId: row.source_enrollment_id,
        sourceClassId: enr.class_id,
        sourceClassLabel: classLabel(cls, grade?.name ?? "Grade"),
        sourceGradeName: grade?.name ?? "Grade",
        disposition: row.disposition as YearEndDisposition,
        destinationClassId: row.destination_class_id,
        destinationClassLabel: dest?.label ?? null,
        destinationGradeLevelId: row.destination_grade_level_id,
        reason: row.reason,
      };
    },
  );

  items.sort((a, b) => a.studentName.localeCompare(b.studentName));

  const { data: toEnrollments } = await supabase
    .from("student_enrollments")
    .select("student_id, status, classes!inner ( is_active )")
    .eq("school_year_id", plan.toSchoolYearId)
    .eq("status", OPERATIONAL_ACTIVE_ENROLLMENT_STATUS)
    .eq("classes.is_active", true);

  const studentsWithActiveToYearEnrollment = new Set(
    (toEnrollments ?? []).map((e) => e.student_id as string),
  );

  const previewItems: PreviewItemInput[] = items.map((item) => ({
    id: item.id,
    studentId: item.studentId,
    studentNumber: item.studentNumber,
    disposition: item.disposition,
    reason: item.reason,
    destinationClassId: item.destinationClassId,
    sourceEnrollmentId: item.sourceEnrollmentId,
  }));

  const toYearClassesById = new Map(
    ((toClassRows ?? []) as ClassRef[]).map((c) => [c.id, c]),
  );

  const blockers = collectPreviewBlockers(previewItems, {
    toSchoolYearId: plan.toSchoolYearId,
    toYearClassesById,
    studentsWithActiveToYearEnrollment,
  });
  const counts = summarizePreview(previewItems, blockers);
  const readyEligible = canMarkPlanReady(previewItems, blockers);

  return {
    ok: true,
    step,
    currentYearId,
    schoolYears,
    gradeLevels,
    plans,
    plan,
    fromClasses,
    toClasses,
    classMaps,
    items,
    toYearTermCodes,
    missingToYearTerms,
    blockers,
    counts,
    readyEligible,
  };
}
