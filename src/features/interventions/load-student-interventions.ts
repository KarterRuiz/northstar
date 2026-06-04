import "server-only";

import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStudentId } from "@/lib/students/uuid";

import {
  type InterventionSeverity,
  type InterventionStatus,
  type InterventionType,
  interventionSeverities,
  interventionStatuses,
  interventionTypes,
} from "./schema";
import type { StudentInterventionRow } from "./types";

type DbRow = {
  id: string;
  student_id: string;
  class_id: string;
  school_year_id: string;
  intervention_type: string;
  status: string;
  severity: string;
  title: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  follow_up_date: string | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function parseType(v: string): InterventionType {
  return interventionTypes.includes(v as InterventionType)
    ? (v as InterventionType)
    : "academic_support";
}

function parseStatus(v: string): InterventionStatus {
  return interventionStatuses.includes(v as InterventionStatus)
    ? (v as InterventionStatus)
    : "active";
}

function parseSeverity(v: string): InterventionSeverity {
  return interventionSeverities.includes(v as InterventionSeverity)
    ? (v as InterventionSeverity)
    : "medium";
}

function mapRow(row: DbRow): StudentInterventionRow {
  const profile = unwrapOne(row.profiles);
  return {
    id: row.id,
    studentId: row.student_id,
    classId: row.class_id,
    schoolYearId: row.school_year_id,
    interventionType: parseType(row.intervention_type),
    status: parseStatus(row.status),
    severity: parseSeverity(row.severity),
    title: row.title,
    description: row.description ?? "",
    createdBy: row.created_by,
    createdByName: profile?.full_name?.trim() || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    followUpDate: row.follow_up_date,
  };
}

export const loadStudentInterventions = cache(
  async (
    studentId: string,
  ): Promise<
    | { ok: true; interventions: StudentInterventionRow[] }
    | { ok: false; message: string }
  > => {
    if (!isStudentId(studentId)) {
      return { ok: false, message: "Invalid student id." };
    }
    if (!isSupabaseConfigured()) {
      return { ok: true, interventions: [] };
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("student_interventions")
      .select(
        `
        id,
        student_id,
        class_id,
        school_year_id,
        intervention_type,
        status,
        severity,
        title,
        description,
        created_by,
        created_at,
        updated_at,
        resolved_at,
        follow_up_date,
        profiles:created_by ( full_name )
      `,
      )
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false });

    if (error) {
      return { ok: false, message: error.message };
    }

    return {
      ok: true,
      interventions: ((data ?? []) as DbRow[]).map(mapRow),
    };
  },
);
