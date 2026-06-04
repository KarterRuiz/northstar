import "server-only";

import { cache } from "react";

import { isRole, type Role } from "@/config/roles";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type StaffProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "role" | "full_name" | "email" | "is_active" | "created_at" | "updated_at"
>;

export type StaffDirectoryPage = {
  rows: StaffProfileRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  error: string | null;
  filters: {
    q: string;
    role: Role | "";
    status: "all" | "active" | "inactive";
  };
};

export type StaffClassAssignmentRow = {
  assignmentId: string;
  teacherProfileId: string;
  classId: string;
  className: string;
  section: string | null;
  schoolYearLabel: string;
  gradeName: string;
  assignmentRole: string;
  classIsActive: boolean;
};

const DEFAULT_PAGE_SIZE = 25;

function clampPage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function firstString(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function assignmentSortLabel(a: StaffClassAssignmentRow): string {
  return `${a.schoolYearLabel} ${a.gradeName} ${a.className}`.toLowerCase();
}

export const fetchStaffDirectoryPage = cache(
  async (searchParams: {
    page?: string | string[];
    q?: string | string[];
    role?: string | string[];
    status?: string | string[];
  }): Promise<StaffDirectoryPage> => {
    const page = clampPage(firstString(searchParams.page));
    const pageSize = DEFAULT_PAGE_SIZE;
    const qRaw = firstString(searchParams.q)?.trim() ?? "";
    const roleRaw = firstString(searchParams.role)?.trim() ?? "";
    const statusRaw = firstString(searchParams.status)?.trim() ?? "all";

    const roleFilter: Role | "" = isRole(roleRaw) ? roleRaw : "";
    const statusFilter: "all" | "active" | "inactive" =
      statusRaw === "active" || statusRaw === "inactive" ? statusRaw : "all";

    if (!isSupabaseConfigured()) {
      return {
        rows: [],
        totalCount: 0,
        page: 1,
        pageSize,
        error: "Supabase is not configured.",
        filters: { q: qRaw, role: roleFilter, status: statusFilter },
      };
    }

    const supabase = await createServerSupabaseClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let listQuery = supabase
      .from("profiles")
      .select("id, role, full_name, email, is_active, created_at, updated_at")
      .order("role", { ascending: true })
      .order("full_name", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });

    if (qRaw.length > 0) {
      const safe = escapeIlike(qRaw);
      listQuery = listQuery.or(
        `full_name.ilike.%${safe}%,email.ilike.%${safe}%`,
      );
    }
    if (roleFilter) {
      listQuery = listQuery.eq("role", roleFilter);
    }
    if (statusFilter === "active") {
      listQuery = listQuery.eq("is_active", true);
    } else if (statusFilter === "inactive") {
      listQuery = listQuery.eq("is_active", false);
    }

    let countQuery = supabase.from("profiles").select("id", { count: "exact", head: true });
    if (qRaw.length > 0) {
      const safe = escapeIlike(qRaw);
      countQuery = countQuery.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
    }
    if (roleFilter) {
      countQuery = countQuery.eq("role", roleFilter);
    }
    if (statusFilter === "active") {
      countQuery = countQuery.eq("is_active", true);
    } else if (statusFilter === "inactive") {
      countQuery = countQuery.eq("is_active", false);
    }

    const [listRes, countRes] = await Promise.all([
      listQuery.range(from, to),
      countQuery,
    ]);

    const err =
      listRes.error?.message ?? countRes.error?.message ?? null;

    return {
      rows: (listRes.data ?? []) as StaffProfileRow[],
      totalCount: countRes.count ?? 0,
      page,
      pageSize,
      error: err,
      filters: { q: qRaw, role: roleFilter, status: statusFilter },
    };
  },
);

export const fetchClassAssignmentsForTeachers = cache(
  async (teacherIds: string[]): Promise<Map<string, StaffClassAssignmentRow[]>> => {
    const map = new Map<string, StaffClassAssignmentRow[]>();
    if (teacherIds.length === 0 || !isSupabaseConfigured()) return map;

    const supabase = await createServerSupabaseClient();
    const { data: ctRows, error: ctErr } = await supabase
      .from("class_teachers")
      .select("id, teacher_profile_id, class_id, role")
      .in("teacher_profile_id", teacherIds);

    if (ctErr || !ctRows?.length) return map;

    const classIds = [...new Set(ctRows.map((r) => r.class_id))];
    const { data: classes, error: cErr } = await supabase
      .from("classes")
      .select("id, name, section, is_active, school_year_id, grade_level_id")
      .in("id", classIds);

    if (cErr || !classes?.length) return map;

    const schoolYearIds = [...new Set(classes.map((c) => c.school_year_id))];
    const gradeIds = [...new Set(classes.map((c) => c.grade_level_id))];

    const [yearsRes, gradesRes] = await Promise.all([
      supabase.from("school_years").select("id, label").in("id", schoolYearIds),
      supabase.from("grade_levels").select("id, name").in("id", gradeIds),
    ]);

    const yearLabel = new Map((yearsRes.data ?? []).map((y) => [y.id, y.label]));
    const gradeName = new Map((gradesRes.data ?? []).map((g) => [g.id, g.name]));
    const classById = new Map(classes.map((c) => [c.id, c]));

    for (const row of ctRows) {
      const klass = classById.get(row.class_id);
      if (!klass) continue;
      const entry: StaffClassAssignmentRow = {
        assignmentId: row.id,
        teacherProfileId: row.teacher_profile_id,
        classId: klass.id,
        className: klass.name,
        section: klass.section,
        schoolYearLabel: yearLabel.get(klass.school_year_id) ?? "—",
        gradeName: gradeName.get(klass.grade_level_id) ?? "—",
        assignmentRole: row.role,
        classIsActive: klass.is_active,
      };
      const list = map.get(row.teacher_profile_id) ?? [];
      list.push(entry);
      map.set(row.teacher_profile_id, list);
    }

    for (const [k, list] of map) {
      list.sort((a, b) => assignmentSortLabel(a).localeCompare(assignmentSortLabel(b)));
      map.set(k, list);
    }

    return map;
  },
);
