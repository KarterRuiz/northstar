"use server";

import { revalidatePath } from "next/cache";

import { canManageSchoolStructure, type Role } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit/logger";
import { getProfileRole } from "@/lib/auth/session";
import {
  logServerError,
  safeUserFacingMessage,
} from "@/lib/errors/safe-user-message";
import { missingStandardTermCodes, standardTermName } from "@/lib/school-years/school-year-integrity";
import type { StandardTermCode } from "@/lib/school-years/school-year-integrity";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OPERATIONAL_ACTIVE_ENROLLMENT_STATUS } from "@/features/students/active-student-enrollments";

import {
  dispositionRequiresReason,
} from "./grade-ladder";
import {
  classStructureKey,
  proposeNextGradeShells,
  suggestLineageClassMaps,
} from "./class-lineage";
import { buildDefaultPlanItems, mergePlanItemsOnRefresh } from "./plan-items";
import {
  canMarkPlanReady,
  collectPreviewBlockers,
  summarizePreview,
  type PreviewItemInput,
} from "./preview-validation";
import type {
  ClassRef,
  GradeLevelRef,
  YearEndDisposition,
  YearEndPlanStatus,
} from "./types";
import { YEAR_END_DISPOSITIONS } from "./types";

export type YearEndMutationState =
  | { ok: true; message?: string; planId?: string }
  | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function trimStr(value: unknown, max: number): string {
  const s = String(value ?? "").trim();
  if (s.length > max) return s.slice(0, max);
  return s;
}

function failDb(scope: string, raw: string, fallback: string): { ok: false; error: string } {
  logServerError(`year-end.${scope}`, raw);
  return { ok: false, error: safeUserFacingMessage(raw, fallback) };
}

async function requireStructureManager(): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      userId: string;
      role: Role;
    }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const role = await getProfileRole(userData.user.id);
  if (!role || !canManageSchoolStructure(role)) {
    return { ok: false, error: "You do not have permission to manage year-end planning." };
  }

  return { ok: true, supabase, userId: userData.user.id, role };
}

function revalidateYearEnd(role: Role, planId?: string) {
  revalidatePath(`/dashboard/${role}/year-end`);
  if (planId) {
    revalidatePath(`/dashboard/${role}/year-end?plan=${planId}`);
  }
  revalidatePath(`/dashboard/${role}/classes`);
  revalidatePath(`/dashboard/${role}/school-settings`);
}

function isDisposition(value: string): value is YearEndDisposition {
  return (YEAR_END_DISPOSITIONS as readonly string[]).includes(value);
}

async function loadGradeLevels(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<GradeLevelRef[]> {
  const { data, error } = await supabase
    .from("grade_levels")
    .select("id, name, code, sort_order, is_archived")
    .order("sort_order", { ascending: true });
  if (error) {
    logServerError("year-end.loadGradeLevels", error.message);
    return [];
  }
  return (data ?? []) as GradeLevelRef[];
}

async function loadYearClasses(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  schoolYearId: string,
): Promise<ClassRef[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, school_year_id, grade_level_id, name, section, is_active")
    .eq("school_year_id", schoolYearId);
  if (error) {
    logServerError("year-end.loadYearClasses", error.message);
    return [];
  }
  return (data ?? []) as ClassRef[];
}

/**
 * Create or reopen a draft/ready plan for a from→to year pair.
 * Does not mutate students or enrollments.
 */
export async function createOrOpenYearEndPlanAction(
  _prev: YearEndMutationState | undefined,
  formData: FormData,
): Promise<YearEndMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const fromSchoolYearId = trimStr(formData.get("fromSchoolYearId"), 64);
  const toSchoolYearId = trimStr(formData.get("toSchoolYearId"), 64);

  if (!isUuid(fromSchoolYearId) || !isUuid(toSchoolYearId)) {
    return { ok: false, error: "Choose valid closing and next school years." };
  }
  if (fromSchoolYearId === toSchoolYearId) {
    return { ok: false, error: "Closing year and next year must be different." };
  }

  const { data: years, error: yearsErr } = await ctx.supabase
    .from("school_years")
    .select("id, label, archived_at")
    .in("id", [fromSchoolYearId, toSchoolYearId]);

  if (yearsErr) {
    return failDb("createPlan.loadYears", yearsErr.message, "Could not load school years.");
  }

  const fromYear = (years ?? []).find((y) => y.id === fromSchoolYearId);
  const toYear = (years ?? []).find((y) => y.id === toSchoolYearId);
  if (!fromYear || !toYear) {
    return { ok: false, error: "One or both school years were not found." };
  }
  if (fromYear.archived_at) {
    return { ok: false, error: "Closing year is archived. Restore it before planning." };
  }
  if (toYear.archived_at) {
    return { ok: false, error: "Next year is archived. Restore it before planning." };
  }

  const { data: existing, error: existErr } = await ctx.supabase
    .from("year_end_plans")
    .select("id, status")
    .eq("from_school_year_id", fromSchoolYearId)
    .eq("to_school_year_id", toSchoolYearId)
    .in("status", ["draft", "ready"])
    .maybeSingle();

  if (existErr) {
    return failDb("createPlan.findExisting", existErr.message, "Could not open year-end plan.");
  }

  if (existing?.id) {
    revalidateYearEnd(ctx.role, existing.id);
    return {
      ok: true,
      planId: existing.id,
      message: `Opened existing ${existing.status} plan.`,
    };
  }

  const { data: created, error: createErr } = await ctx.supabase
    .from("year_end_plans")
    .insert({
      from_school_year_id: fromSchoolYearId,
      to_school_year_id: toSchoolYearId,
      status: "draft" satisfies YearEndPlanStatus,
      created_by: ctx.userId,
    })
    .select("id")
    .maybeSingle();

  if (createErr) {
    return failDb("createPlan.insert", createErr.message, "Could not create year-end plan.");
  }
  if (!created?.id) {
    return { ok: false, error: "Plan was not created." };
  }

  await recordAuditEvent({
    action: "year_end_plan_created",
    actorUserId: ctx.userId,
    metadata: {
      planId: created.id,
      fromSchoolYearId,
      toSchoolYearId,
    },
  });

  // Seed empty class map rows for active from-year classes (to_class null).
  const fromClasses = await loadYearClasses(ctx.supabase, fromSchoolYearId);
  const activeFrom = fromClasses.filter((c) => c.is_active);
  if (activeFrom.length > 0) {
    const { error: mapErr } = await ctx.supabase.from("year_end_class_maps").insert(
      activeFrom.map((c) => ({
        plan_id: created.id,
        from_class_id: c.id,
        to_class_id: null,
      })),
    );
    if (mapErr) {
      logServerError("year-end.createPlan.seedMaps", mapErr.message);
    }
  }

  revalidateYearEnd(ctx.role, created.id);
  return {
    ok: true,
    planId: created.id,
    message: `Draft plan created for ${fromYear.label} → ${toYear.label}.`,
  };
}

/** Ensure T1–T4 exist for the plan's next year (nullable dates). */
export async function ensureYearEndNextYearTermsAction(
  _prev: YearEndMutationState | undefined,
  formData: FormData,
): Promise<YearEndMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const planId = trimStr(formData.get("planId"), 64);
  if (!isUuid(planId)) return { ok: false, error: "Invalid plan." };

  const { data: plan, error: planErr } = await ctx.supabase
    .from("year_end_plans")
    .select("id, to_school_year_id, status")
    .eq("id", planId)
    .maybeSingle();

  if (planErr) return failDb("ensureTerms.loadPlan", planErr.message, "Could not load plan.");
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status === "finalized") {
    return { ok: false, error: "This plan is finalized and cannot be edited." };
  }

  const { data: year, error: yearErr } = await ctx.supabase
    .from("school_years")
    .select("id, label, archived_at")
    .eq("id", plan.to_school_year_id)
    .maybeSingle();

  if (yearErr) return failDb("ensureTerms.loadYear", yearErr.message, "Could not load next year.");
  if (!year || year.archived_at) {
    return { ok: false, error: "Next school year is missing or archived." };
  }

  const { data: existing, error: termsErr } = await ctx.supabase
    .from("terms")
    .select("code")
    .eq("school_year_id", plan.to_school_year_id);

  if (termsErr) return failDb("ensureTerms.loadTerms", termsErr.message, "Could not load terms.");

  const missing = missingStandardTermCodes((existing ?? []).map((t) => t.code));
  if (missing.length === 0) {
    return { ok: true, message: `“${year.label}” already has T1–T4.` };
  }

  const rows = missing.map((code: StandardTermCode) => ({
    school_year_id: plan.to_school_year_id,
    code,
    name: standardTermName(code),
    starts_on: null,
    ends_on: null,
  }));

  const { error: insertErr } = await ctx.supabase.from("terms").insert(rows);
  if (insertErr) return failDb("ensureTerms.insert", insertErr.message, "Could not create terms.");

  await recordAuditEvent({
    action: "year_end_plan_updated",
    actorUserId: ctx.userId,
    metadata: {
      planId,
      change: "ensure_terms",
      createdCodes: missing.join(","),
    },
  });

  revalidateYearEnd(ctx.role, planId);
  return {
    ok: true,
    message: `Created ${missing.join(", ")} for “${year.label}” (dates unset).`,
  };
}

/**
 * Copy STRUCTURE ONLY from selected from-year classes into the next year.
 * Never copies students, enrollments, attendance, report cards, or gradebook.
 *
 * bumpGrade=0: same-grade shells (retain name/section).
 * bumpGrade=1: cohort-driven next-grade shells — one shell per source class
 * below Grade 5, named from the source (ECG1-1→ECG2-1), independent of how
 * many destination-grade classes already exist. Does not auto-save mappings;
 * use applyYearEndSuggestedClassMapsAction after review.
 */
export async function copyYearEndClassStructureAction(
  _prev: YearEndMutationState | undefined,
  formData: FormData,
): Promise<YearEndMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const planId = trimStr(formData.get("planId"), 64);
  const bumpGrade = trimStr(formData.get("bumpGrade"), 8) === "1";

  if (!isUuid(planId)) return { ok: false, error: "Invalid plan." };

  const { data: plan, error: planErr } = await ctx.supabase
    .from("year_end_plans")
    .select("id, from_school_year_id, to_school_year_id, status")
    .eq("id", planId)
    .maybeSingle();

  if (planErr) return failDb("copyStructure.loadPlan", planErr.message, "Could not load plan.");
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "draft") {
    return { ok: false, error: "Revert the plan to draft before copying class structure." };
  }

  const grades = await loadGradeLevels(ctx.supabase);
  const gradesById = new Map(grades.map((g) => [g.id, g]));
  const fromClasses = (await loadYearClasses(ctx.supabase, plan.from_school_year_id)).filter(
    (c) => c.is_active,
  );
  const toClasses = await loadYearClasses(ctx.supabase, plan.to_school_year_id);

  const existingKeys = new Set(
    toClasses.map((c) => classStructureKey(c.grade_level_id, c.name, c.section)),
  );

  let created = 0;
  let skipped = 0;
  /** Same-grade copy may still link maps by exact match; next-grade does not auto-map. */
  const newMaps: { from_class_id: string; to_class_id: string }[] = [];

  if (bumpGrade) {
    const proposals = proposeNextGradeShells({
      sourceClasses: fromClasses,
      gradesById,
      allGrades: grades,
    });

    for (const proposal of proposals) {
      if (proposal.skippedReason) {
        skipped += 1;
        continue;
      }

      const key = classStructureKey(
        proposal.targetGradeLevelId,
        proposal.name,
        proposal.section,
      );
      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }

      const { data: inserted, error: insErr } = await ctx.supabase
        .from("classes")
        .insert({
          school_year_id: plan.to_school_year_id,
          grade_level_id: proposal.targetGradeLevelId,
          name: proposal.name,
          section: proposal.section,
          is_active: true,
        })
        .select("id")
        .maybeSingle();

      if (insErr || !inserted?.id) {
        logServerError("year-end.copyStructure.insert", insErr?.message ?? "no id");
        skipped += 1;
        continue;
      }

      created += 1;
      existingKeys.add(key);
      toClasses.push({
        id: inserted.id,
        school_year_id: plan.to_school_year_id,
        grade_level_id: proposal.targetGradeLevelId,
        name: proposal.name,
        section: proposal.section,
        is_active: true,
      });

      await recordAuditEvent({
        action: "class_created",
        actorUserId: ctx.userId,
        metadata: {
          classId: inserted.id,
          schoolYearId: plan.to_school_year_id,
          gradeLevelId: proposal.targetGradeLevelId,
          source: "year_end_structure_copy",
          sourceClassId: proposal.sourceClassId,
        },
      });
    }
  } else {
    for (const source of fromClasses) {
      const targetGradeId = source.grade_level_id;
      const key = classStructureKey(targetGradeId, source.name, source.section);
      if (existingKeys.has(key)) {
        skipped += 1;
        const match = toClasses.find(
          (c) => classStructureKey(c.grade_level_id, c.name, c.section) === key,
        );
        if (match) {
          newMaps.push({ from_class_id: source.id, to_class_id: match.id });
        }
        continue;
      }

      const { data: inserted, error: insErr } = await ctx.supabase
        .from("classes")
        .insert({
          school_year_id: plan.to_school_year_id,
          grade_level_id: targetGradeId,
          name: source.name,
          section: source.section,
          is_active: true,
        })
        .select("id")
        .maybeSingle();

      if (insErr || !inserted?.id) {
        logServerError("year-end.copyStructure.insert", insErr?.message ?? "no id");
        skipped += 1;
        continue;
      }

      created += 1;
      existingKeys.add(key);
      toClasses.push({
        id: inserted.id,
        school_year_id: plan.to_school_year_id,
        grade_level_id: targetGradeId,
        name: source.name,
        section: source.section,
        is_active: true,
      });
      newMaps.push({ from_class_id: source.id, to_class_id: inserted.id });

      await recordAuditEvent({
        action: "class_created",
        actorUserId: ctx.userId,
        metadata: {
          classId: inserted.id,
          schoolYearId: plan.to_school_year_id,
          gradeLevelId: targetGradeId,
          source: "year_end_structure_copy",
          sourceClassId: source.id,
        },
      });
    }
  }

  for (const map of newMaps) {
    const { data: existingMap } = await ctx.supabase
      .from("year_end_class_maps")
      .select("id")
      .eq("plan_id", planId)
      .eq("from_class_id", map.from_class_id)
      .maybeSingle();

    if (existingMap?.id) {
      await ctx.supabase
        .from("year_end_class_maps")
        .update({ to_class_id: map.to_class_id })
        .eq("id", existingMap.id);
    } else {
      await ctx.supabase.from("year_end_class_maps").insert({
        plan_id: planId,
        from_class_id: map.from_class_id,
        to_class_id: map.to_class_id,
      });
    }
  }

  await recordAuditEvent({
    action: "year_end_mapping_changed",
    actorUserId: ctx.userId,
    metadata: {
      planId,
      change: "structure_copy",
      createdCount: created,
      skippedCount: skipped,
      bumpGrade,
    },
  });

  revalidateYearEnd(ctx.role, planId);
  if (bumpGrade) {
    return {
      ok: true,
      message: `Created ${created} next-grade shell${created === 1 ? "" : "s"} (skipped ${skipped}). Review lineage suggestions before saving maps. No students or enrollments were copied.`,
    };
  }
  return {
    ok: true,
    message: `Copied structure for ${created} class${created === 1 ? "" : "es"} (skipped ${skipped}). No students or enrollments were copied.`,
  };
}

/**
 * Apply deterministic 1:1 lineage map suggestions for unmapped source classes.
 * Does not overwrite existing non-null destinations. Never creates enrollments.
 */
export async function applyYearEndSuggestedClassMapsAction(
  _prev: YearEndMutationState | undefined,
  formData: FormData,
): Promise<YearEndMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const planId = trimStr(formData.get("planId"), 64);
  if (!isUuid(planId)) return { ok: false, error: "Invalid plan." };

  const { data: plan, error: planErr } = await ctx.supabase
    .from("year_end_plans")
    .select("id, from_school_year_id, to_school_year_id, status")
    .eq("id", planId)
    .maybeSingle();

  if (planErr) return failDb("applyMaps.loadPlan", planErr.message, "Could not load plan.");
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status === "finalized") {
    return { ok: false, error: "Finalized plans cannot be edited." };
  }
  if (plan.status === "ready") {
    await ctx.supabase.from("year_end_plans").update({ status: "draft" }).eq("id", planId);
  }

  const grades = await loadGradeLevels(ctx.supabase);
  const gradesById = new Map(grades.map((g) => [g.id, g]));
  const fromClasses = (await loadYearClasses(ctx.supabase, plan.from_school_year_id)).filter(
    (c) => c.is_active,
  );
  const toClasses = (await loadYearClasses(ctx.supabase, plan.to_school_year_id)).filter(
    (c) => c.is_active,
  );

  const suggestions = suggestLineageClassMaps({
    sourceClasses: fromClasses,
    destinationClasses: toClasses,
    gradesById,
    allGrades: grades,
  });

  const { data: existingMaps } = await ctx.supabase
    .from("year_end_class_maps")
    .select("id, from_class_id, to_class_id")
    .eq("plan_id", planId);

  const existingByFrom = new Map(
    (existingMaps ?? []).map((m) => [m.from_class_id, m] as const),
  );

  let applied = 0;
  let skipped = 0;

  for (const suggestion of suggestions) {
    const prev = existingByFrom.get(suggestion.fromClassId);
    if (prev?.to_class_id) {
      skipped += 1;
      continue;
    }

    if (prev?.id) {
      const { error } = await ctx.supabase
        .from("year_end_class_maps")
        .update({ to_class_id: suggestion.toClassId })
        .eq("id", prev.id);
      if (error) {
        return failDb("applyMaps.update", error.message, "Could not apply suggested maps.");
      }
    } else {
      const { error } = await ctx.supabase.from("year_end_class_maps").insert({
        plan_id: planId,
        from_class_id: suggestion.fromClassId,
        to_class_id: suggestion.toClassId,
      });
      if (error) {
        return failDb("applyMaps.insert", error.message, "Could not apply suggested maps.");
      }
    }
    applied += 1;
  }

  await recordAuditEvent({
    action: "year_end_mapping_changed",
    actorUserId: ctx.userId,
    metadata: {
      planId,
      change: "apply_lineage_suggestions",
      applied,
      skipped,
    },
  });

  revalidateYearEnd(ctx.role, planId);
  return {
    ok: true,
    message: `Applied ${applied} lineage map suggestion${applied === 1 ? "" : "s"} (skipped ${skipped} already mapped).`,
  };
}

/**
 * Create one next-year destination shell from Year-End planning.
 * Structure only — no enrollments. Name/section must be provided by admin.
 */
export async function createYearEndDestinationClassAction(
  _prev: YearEndMutationState | undefined,
  formData: FormData,
): Promise<YearEndMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const planId = trimStr(formData.get("planId"), 64);
  const gradeLevelId = trimStr(formData.get("gradeLevelId"), 64);
  const name = trimStr(formData.get("name"), 120);
  const sectionRaw = trimStr(formData.get("section"), 80);
  const section = sectionRaw.length > 0 ? sectionRaw : null;

  if (!isUuid(planId) || !isUuid(gradeLevelId)) {
    return { ok: false, error: "Invalid plan or grade level." };
  }
  if (!name) {
    return { ok: false, error: "Class name is required." };
  }

  const { data: plan, error: planErr } = await ctx.supabase
    .from("year_end_plans")
    .select("id, to_school_year_id, status")
    .eq("id", planId)
    .maybeSingle();

  if (planErr) return failDb("createDest.loadPlan", planErr.message, "Could not load plan.");
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status === "finalized") {
    return { ok: false, error: "Finalized plans cannot be edited." };
  }
  if (plan.status !== "draft") {
    return { ok: false, error: "Revert the plan to draft before adding destination classes." };
  }

  const grades = await loadGradeLevels(ctx.supabase);
  const grade = grades.find((g) => g.id === gradeLevelId);
  if (!grade || grade.is_archived) {
    return { ok: false, error: "Choose an active grade level." };
  }

  const toClasses = await loadYearClasses(ctx.supabase, plan.to_school_year_id);
  const key = classStructureKey(gradeLevelId, name, section);
  if (
    toClasses.some(
      (c) => classStructureKey(c.grade_level_id, c.name, c.section) === key,
    )
  ) {
    return {
      ok: false,
      error: "A class with this name and section already exists in the next year.",
    };
  }

  const { data: inserted, error: insErr } = await ctx.supabase
    .from("classes")
    .insert({
      school_year_id: plan.to_school_year_id,
      grade_level_id: gradeLevelId,
      name,
      section,
      is_active: true,
    })
    .select("id")
    .maybeSingle();

  if (insErr || !inserted?.id) {
    return failDb(
      "createDest.insert",
      insErr?.message ?? "no id",
      "Could not create destination class.",
    );
  }

  await recordAuditEvent({
    action: "class_created",
    actorUserId: ctx.userId,
    metadata: {
      classId: inserted.id,
      schoolYearId: plan.to_school_year_id,
      gradeLevelId,
      source: "year_end_add_destination",
    },
  });

  revalidateYearEnd(ctx.role, planId);
  return {
    ok: true,
    message: `Created destination class “${name}” in ${grade.name}. No students were enrolled.`,
  };
}

export async function updateYearEndClassMapAction(
  _prev: YearEndMutationState | undefined,
  formData: FormData,
): Promise<YearEndMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const planId = trimStr(formData.get("planId"), 64);
  const fromClassId = trimStr(formData.get("fromClassId"), 64);
  const toClassIdRaw = trimStr(formData.get("toClassId"), 64);
  const toClassId = toClassIdRaw === "" || toClassIdRaw === "__none__" ? null : toClassIdRaw;

  if (!isUuid(planId) || !isUuid(fromClassId)) {
    return { ok: false, error: "Invalid class mapping." };
  }
  if (toClassId && !isUuid(toClassId)) {
    return { ok: false, error: "Choose a valid destination class." };
  }

  const { data: plan, error: planErr } = await ctx.supabase
    .from("year_end_plans")
    .select("id, from_school_year_id, to_school_year_id, status")
    .eq("id", planId)
    .maybeSingle();

  if (planErr) return failDb("updateMap.loadPlan", planErr.message, "Could not load plan.");
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status === "finalized") {
    return { ok: false, error: "Finalized plans cannot be edited." };
  }
  if (plan.status === "ready") {
    // Allow edits but demote to draft.
    await ctx.supabase.from("year_end_plans").update({ status: "draft" }).eq("id", planId);
  }

  const { data: fromClass } = await ctx.supabase
    .from("classes")
    .select("id, school_year_id")
    .eq("id", fromClassId)
    .maybeSingle();

  if (!fromClass || fromClass.school_year_id !== plan.from_school_year_id) {
    return { ok: false, error: "Source class must belong to the closing year." };
  }

  if (toClassId) {
    const { data: toClass } = await ctx.supabase
      .from("classes")
      .select("id, school_year_id, is_active")
      .eq("id", toClassId)
      .maybeSingle();
    if (!toClass || toClass.school_year_id !== plan.to_school_year_id) {
      return { ok: false, error: "Destination class must belong to the next year." };
    }
    if (!toClass.is_active) {
      return { ok: false, error: "Destination class is archived." };
    }
  }

  const { data: existing } = await ctx.supabase
    .from("year_end_class_maps")
    .select("id")
    .eq("plan_id", planId)
    .eq("from_class_id", fromClassId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await ctx.supabase
      .from("year_end_class_maps")
      .update({ to_class_id: toClassId })
      .eq("id", existing.id);
    if (error) return failDb("updateMap.update", error.message, "Could not update mapping.");
  } else {
    const { error } = await ctx.supabase.from("year_end_class_maps").insert({
      plan_id: planId,
      from_class_id: fromClassId,
      to_class_id: toClassId,
    });
    if (error) return failDb("updateMap.insert", error.message, "Could not save mapping.");
  }

  await recordAuditEvent({
    action: "year_end_mapping_changed",
    actorUserId: ctx.userId,
    metadata: {
      planId,
      fromClassId,
      toClassId,
    },
  });

  revalidateYearEnd(ctx.role, planId);
  return { ok: true, message: "Class mapping saved." };
}

/**
 * Idempotent refresh of plan items for operationally active students in the closing year.
 * Preserves existing disposition overrides; does not duplicate rows.
 */
export async function refreshYearEndPlanItemsAction(
  _prev: YearEndMutationState | undefined,
  formData: FormData,
): Promise<YearEndMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const planId = trimStr(formData.get("planId"), 64);
  if (!isUuid(planId)) return { ok: false, error: "Invalid plan." };

  const { data: plan, error: planErr } = await ctx.supabase
    .from("year_end_plans")
    .select("id, from_school_year_id, to_school_year_id, status")
    .eq("id", planId)
    .maybeSingle();

  if (planErr) return failDb("refreshItems.loadPlan", planErr.message, "Could not load plan.");
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status === "finalized") {
    return { ok: false, error: "Finalized plans cannot be refreshed." };
  }

  if (plan.status === "ready") {
    await ctx.supabase.from("year_end_plans").update({ status: "draft" }).eq("id", planId);
  }

  const { data: enrollments, error: enrErr } = await ctx.supabase
    .from("student_enrollments")
    .select(
      `
      id,
      student_id,
      class_id,
      school_year_id,
      status,
      classes!inner (
        id,
        school_year_id,
        grade_level_id,
        name,
        section,
        is_active
      ),
      students!inner (
        id,
        external_id
      )
    `,
    )
    .eq("school_year_id", plan.from_school_year_id)
    .eq("status", OPERATIONAL_ACTIVE_ENROLLMENT_STATUS)
    .eq("classes.is_active", true);

  if (enrErr) {
    return failDb("refreshItems.loadEnrollments", enrErr.message, "Could not load students.");
  }

  type EnrRow = {
    id: string;
    student_id: string;
    class_id: string;
    classes: ClassRef | ClassRef[];
    students: { id: string; external_id: string | null } | { id: string; external_id: string | null }[];
  };

  const eligible = ((enrollments ?? []) as unknown as EnrRow[]).map((row) => {
    const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    const stu = Array.isArray(row.students) ? row.students[0] : row.students;
    return {
      studentId: row.student_id,
      studentNumber: stu?.external_id ?? null,
      sourceEnrollmentId: row.id,
      sourceClassId: row.class_id,
      sourceGradeLevelId: cls?.grade_level_id ?? "",
      sourceClass: cls,
    };
  });

  const grades = await loadGradeLevels(ctx.supabase);
  const gradesById = new Map(grades.map((g) => [g.id, g]));
  const fromClasses = await loadYearClasses(ctx.supabase, plan.from_school_year_id);
  const toClasses = await loadYearClasses(ctx.supabase, plan.to_school_year_id);
  const fromClassesById = new Map(fromClasses.map((c) => [c.id, c]));

  const { data: maps } = await ctx.supabase
    .from("year_end_class_maps")
    .select("from_class_id, to_class_id")
    .eq("plan_id", planId);

  const classMaps = new Map<string, string | null>(
    (maps ?? []).map((m) => [m.from_class_id, m.to_class_id]),
  );

  const freshDefaults = buildDefaultPlanItems({
    students: eligible.map((e) => ({
      studentId: e.studentId,
      studentNumber: e.studentNumber,
      sourceEnrollmentId: e.sourceEnrollmentId,
      sourceClassId: e.sourceClassId,
      sourceGradeLevelId: e.sourceGradeLevelId,
    })),
    gradesById,
    allGrades: grades,
    fromClassesById,
    toYearClasses: toClasses,
    toSchoolYearId: plan.to_school_year_id,
    classMaps,
  });

  const { data: existingItems, error: itemsErr } = await ctx.supabase
    .from("year_end_plan_items")
    .select(
      "id, student_id, source_enrollment_id, disposition, destination_class_id, destination_grade_level_id, reason",
    )
    .eq("plan_id", planId);

  if (itemsErr) {
    return failDb("refreshItems.loadItems", itemsErr.message, "Could not load plan items.");
  }

  const merged = mergePlanItemsOnRefresh({
    existing: (existingItems ?? []).map((row) => ({
      studentId: row.student_id,
      sourceEnrollmentId: row.source_enrollment_id,
      disposition: row.disposition as YearEndDisposition,
      destinationClassId: row.destination_class_id,
      destinationGradeLevelId: row.destination_grade_level_id,
      reason: row.reason,
    })),
    freshDefaults,
  });

  const keepStudentIds = new Set(merged.map((m) => m.studentId));
  const toDelete = (existingItems ?? []).filter((row) => !keepStudentIds.has(row.student_id));
  if (toDelete.length > 0) {
    const { error: delErr } = await ctx.supabase
      .from("year_end_plan_items")
      .delete()
      .in(
        "id",
        toDelete.map((r) => r.id),
      );
    if (delErr) {
      return failDb("refreshItems.deleteStale", delErr.message, "Could not refresh plan items.");
    }
  }

  const existingByStudent = new Map(
    (existingItems ?? []).map((row) => [row.student_id, row] as const),
  );

  let inserted = 0;
  let updated = 0;

  for (const item of merged) {
    const prev = existingByStudent.get(item.studentId);
    if (prev) {
      const { error: updErr } = await ctx.supabase
        .from("year_end_plan_items")
        .update({
          source_enrollment_id: item.sourceEnrollmentId,
          // Preserve disposition / destination / reason from merge
          disposition: item.disposition,
          destination_class_id: item.destinationClassId,
          destination_grade_level_id: item.destinationGradeLevelId,
          reason: item.reason,
        })
        .eq("id", prev.id);
      if (updErr) {
        return failDb("refreshItems.update", updErr.message, "Could not refresh plan items.");
      }
      updated += 1;
    } else {
      const { error: insErr } = await ctx.supabase.from("year_end_plan_items").insert({
        plan_id: planId,
        student_id: item.studentId,
        source_enrollment_id: item.sourceEnrollmentId,
        disposition: item.disposition,
        destination_class_id: item.destinationClassId,
        destination_grade_level_id: item.destinationGradeLevelId,
        reason: item.reason,
      });
      if (insErr) {
        return failDb("refreshItems.insert", insErr.message, "Could not refresh plan items.");
      }
      inserted += 1;
    }
  }

  await recordAuditEvent({
    action: "year_end_plan_updated",
    actorUserId: ctx.userId,
    metadata: {
      planId,
      change: "refresh_items",
      inserted,
      updated,
      removed: toDelete.length,
      total: merged.length,
    },
  });

  revalidateYearEnd(ctx.role, planId);
  return {
    ok: true,
    message: `Student plan refreshed (${merged.length} students; +${inserted} / ~${updated} kept).`,
  };
}

export async function updateYearEndPlanItemAction(
  _prev: YearEndMutationState | undefined,
  formData: FormData,
): Promise<YearEndMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const planId = trimStr(formData.get("planId"), 64);
  const itemId = trimStr(formData.get("itemId"), 64);
  const dispositionRaw = trimStr(formData.get("disposition"), 40);
  const destinationClassIdRaw = trimStr(formData.get("destinationClassId"), 64);
  const reason = trimStr(formData.get("reason"), 500);

  if (!isUuid(planId) || !isUuid(itemId)) {
    return { ok: false, error: "Invalid plan item." };
  }
  if (!isDisposition(dispositionRaw)) {
    return { ok: false, error: "Choose a valid disposition." };
  }

  const destinationClassId =
    destinationClassIdRaw === "" || destinationClassIdRaw === "__none__"
      ? null
      : destinationClassIdRaw;

  if (destinationClassId && !isUuid(destinationClassId)) {
    return { ok: false, error: "Choose a valid destination class." };
  }

  if (dispositionRequiresReason(dispositionRaw) && !reason) {
    return { ok: false, error: "Custom disposition requires a reason." };
  }

  const { data: plan, error: planErr } = await ctx.supabase
    .from("year_end_plans")
    .select("id, to_school_year_id, status")
    .eq("id", planId)
    .maybeSingle();

  if (planErr) return failDb("updateItem.loadPlan", planErr.message, "Could not load plan.");
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status === "finalized") {
    return { ok: false, error: "Finalized plans cannot be edited." };
  }

  let destinationGradeLevelId: string | null = null;
  if (destinationClassId) {
    const { data: dest } = await ctx.supabase
      .from("classes")
      .select("id, school_year_id, grade_level_id, is_active")
      .eq("id", destinationClassId)
      .maybeSingle();
    if (!dest || dest.school_year_id !== plan.to_school_year_id) {
      return { ok: false, error: "Destination class must belong to the next year." };
    }
    if (!dest.is_active) {
      return { ok: false, error: "Destination class is archived." };
    }
    destinationGradeLevelId = dest.grade_level_id;
  }

  // Clear destination for exit dispositions.
  const finalDest =
    dispositionRaw === "graduate_primary" || dispositionRaw === "leave_school"
      ? null
      : destinationClassId;
  const finalGrade =
    dispositionRaw === "graduate_primary" || dispositionRaw === "leave_school"
      ? null
      : destinationGradeLevelId;

  const { error: updErr } = await ctx.supabase
    .from("year_end_plan_items")
    .update({
      disposition: dispositionRaw,
      destination_class_id: finalDest,
      destination_grade_level_id: finalGrade,
      reason: reason || null,
    })
    .eq("id", itemId)
    .eq("plan_id", planId);

  if (updErr) {
    return failDb("updateItem.update", updErr.message, "Could not update student plan.");
  }

  if (plan.status === "ready") {
    await ctx.supabase.from("year_end_plans").update({ status: "draft" }).eq("id", planId);
  }

  await recordAuditEvent({
    action: "year_end_disposition_changed",
    actorUserId: ctx.userId,
    metadata: {
      planId,
      itemId,
      disposition: dispositionRaw,
      destinationClassId: finalDest,
    },
  });

  revalidateYearEnd(ctx.role, planId);
  return { ok: true, message: "Student disposition saved." };
}

export async function markYearEndPlanReadyAction(
  _prev: YearEndMutationState | undefined,
  formData: FormData,
): Promise<YearEndMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const planId = trimStr(formData.get("planId"), 64);
  if (!isUuid(planId)) return { ok: false, error: "Invalid plan." };

  const { data: plan, error: planErr } = await ctx.supabase
    .from("year_end_plans")
    .select("id, to_school_year_id, status")
    .eq("id", planId)
    .maybeSingle();

  if (planErr) return failDb("markReady.loadPlan", planErr.message, "Could not load plan.");
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status === "finalized") {
    return { ok: false, error: "Plan is already finalized." };
  }

  const { data: items, error: itemsErr } = await ctx.supabase
    .from("year_end_plan_items")
    .select(
      `
      id,
      student_id,
      disposition,
      reason,
      destination_class_id,
      source_enrollment_id,
      students!inner ( external_id )
    `,
    )
    .eq("plan_id", planId);

  if (itemsErr) {
    return failDb("markReady.loadItems", itemsErr.message, "Could not load plan items.");
  }

  const toClasses = await loadYearClasses(ctx.supabase, plan.to_school_year_id);
  const toYearClassesById = new Map(toClasses.map((c) => [c.id, c]));

  const { data: toEnrollments } = await ctx.supabase
    .from("student_enrollments")
    .select("student_id, status, classes!inner ( is_active, school_year_id )")
    .eq("school_year_id", plan.to_school_year_id)
    .eq("status", OPERATIONAL_ACTIVE_ENROLLMENT_STATUS)
    .eq("classes.is_active", true);

  const studentsWithActiveToYearEnrollment = new Set(
    (toEnrollments ?? []).map((e) => e.student_id as string),
  );

  type ItemRow = {
    id: string;
    student_id: string;
    disposition: string;
    reason: string | null;
    destination_class_id: string | null;
    source_enrollment_id: string;
    students: { external_id: string | null } | { external_id: string | null }[];
  };

  const previewItems: PreviewItemInput[] = ((items ?? []) as unknown as ItemRow[]).map(
    (row) => {
      const stu = Array.isArray(row.students) ? row.students[0] : row.students;
      return {
        id: row.id,
        studentId: row.student_id,
        studentNumber: stu?.external_id ?? null,
        disposition: row.disposition as YearEndDisposition,
        reason: row.reason,
        destinationClassId: row.destination_class_id,
        sourceEnrollmentId: row.source_enrollment_id,
      };
    },
  );

  const blockers = collectPreviewBlockers(previewItems, {
    toSchoolYearId: plan.to_school_year_id,
    toYearClassesById,
    studentsWithActiveToYearEnrollment,
  });

  if (!canMarkPlanReady(previewItems, blockers)) {
    const first = blockers[0]?.message ?? "Resolve all blockers before marking READY.";
    if (previewItems.length === 0) {
      return {
        ok: false,
        error: "Refresh the student plan before marking READY (no students yet).",
      };
    }
    return {
      ok: false,
      error: `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} remain. ${first}`,
    };
  }

  const snapshot = summarizePreview(previewItems, blockers);

  const { error: updErr } = await ctx.supabase
    .from("year_end_plans")
    .update({
      status: "ready" satisfies YearEndPlanStatus,
      preview_snapshot: snapshot,
    })
    .eq("id", planId);

  if (updErr) {
    return failDb("markReady.update", updErr.message, "Could not mark plan ready.");
  }

  await recordAuditEvent({
    action: "year_end_marked_ready",
    actorUserId: ctx.userId,
    metadata: {
      planId,
      totalStudents: snapshot.total,
      blockerCount: snapshot.blockers,
    },
  });

  revalidateYearEnd(ctx.role, planId);
  return {
    ok: true,
    message:
      "Plan marked READY. Finalization will be enabled in a later phase — no placements were changed.",
  };
}

export async function revertYearEndPlanToDraftAction(
  _prev: YearEndMutationState | undefined,
  formData: FormData,
): Promise<YearEndMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const planId = trimStr(formData.get("planId"), 64);
  if (!isUuid(planId)) return { ok: false, error: "Invalid plan." };

  const { data: plan, error: planErr } = await ctx.supabase
    .from("year_end_plans")
    .select("id, status")
    .eq("id", planId)
    .maybeSingle();

  if (planErr) return failDb("revertDraft.loadPlan", planErr.message, "Could not load plan.");
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status === "finalized") {
    return { ok: false, error: "Finalized plans cannot be reverted." };
  }
  if (plan.status === "draft") {
    return { ok: true, message: "Plan is already a draft." };
  }

  const { error: updErr } = await ctx.supabase
    .from("year_end_plans")
    .update({ status: "draft" satisfies YearEndPlanStatus })
    .eq("id", planId);

  if (updErr) {
    return failDb("revertDraft.update", updErr.message, "Could not revert plan.");
  }

  await recordAuditEvent({
    action: "year_end_plan_updated",
    actorUserId: ctx.userId,
    metadata: { planId, change: "revert_to_draft" },
  });

  revalidateYearEnd(ctx.role, planId);
  return { ok: true, message: "Plan reverted to draft." };
}
