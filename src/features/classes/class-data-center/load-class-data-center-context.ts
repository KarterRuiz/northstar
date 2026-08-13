import "server-only";

import { cache } from "react";

import type { Role } from "@/config/roles";
import { CLASS_TEACHER_ROLE_HOMEROOM } from "@/features/classes/constants";
import { formatClassTitle } from "@/features/teacher/dashboard/teacher-home-summaries";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { formatStaffMemberAssignmentLabel } from "@/lib/staff/class-assignable-staff";
import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isUuid } from "@/lib/students/uuid";

import { classIsCurrentSchoolYear } from "@/features/teacher/class-workspace/class-workspace-copy";

import {
  classKindLabelFromHomeroom,
  formatClassDataCenterMeta,
  formatStaffRoleInClass,
  northStarAccountStatusLabel,
} from "./class-data-center-copy";
import { classDataCenterStaffProfileHref } from "./constants";
import { requireLeadershipClassAccess } from "./require-leadership-class-access";

type SchoolYearEmbed = { id?: string; label: string } | null;
type GradeEmbed = { name: string } | null;
type ClassEmbed = {
  id: string;
  name: string;
  section: string | null;
  is_active: boolean;
  school_year_id: string | null;
  grade_level_id: string;
  school_years: SchoolYearEmbed | SchoolYearEmbed[] | null;
  grade_levels: GradeEmbed | GradeEmbed[] | null;
};

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function classYearId(klass: ClassEmbed): string | null {
  const fromColumn = klass.school_year_id?.trim();
  if (fromColumn) return fromColumn;
  return unwrapOne(klass.school_years)?.id?.trim() || null;
}

export type ClassDataCenterStaffMember = {
  staffMemberId: string;
  displayName: string;
  roleInClass: string;
  roleInClassDb: string;
  accountStatus: string;
  href: string;
  profileId: string | null;
};

export type ClassDataCenterContext = {
  id: string;
  role: Role;
  title: string;
  gradeName: string;
  classKindLabel: string;
  meta: string;
  studentCount: number;
  schoolYearId: string | null;
  schoolYearLabel: string;
  gradeLevelId: string;
  section: string | null;
  name: string;
  isCurrentYear: boolean;
  isActive: boolean;
  homeroom: ClassDataCenterStaffMember | null;
  additionalTeachers: ClassDataCenterStaffMember[];
};

export type ClassDataCenterContextResult =
  | { ok: true; context: ClassDataCenterContext }
  | { ok: false; message: string };

/**
 * Lightweight shell context for leadership Class Data Center.
 * Does not load roster rows, gradebook, report cards, or attendance marks.
 */
export const loadClassDataCenterContext = cache(
  async (classId: string): Promise<ClassDataCenterContextResult> => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }
    if (!isUuid(classId)) {
      return { ok: false, message: "This class was not found." };
    }

    const gate = await requireLeadershipClassAccess(classId);
    if (!gate.ok) return gate;

    const { supabase, role } = gate;

    const [classRes, yearRes, countRes, staffingRes] = await Promise.all([
      supabase
        .from("classes")
        .select(
          `
          id,
          name,
          section,
          is_active,
          school_year_id,
          grade_level_id,
          school_years ( id, label ),
          grade_levels ( name )
        `,
        )
        .eq("id", classId)
        .maybeSingle(),
      loadCurrentSchoolYear(supabase),
      supabase
        .from("student_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId)
        .eq("status", "active"),
      supabase
        .from("staff_member_classes")
        .select("id, role, staff_member_id")
        .eq("class_id", classId),
    ]);

    if (classRes.error) {
      logServerError("class-data-center.loadClass", classRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }
    if (!classRes.data?.id) {
      return { ok: false, message: "This class was not found." };
    }
    if (!yearRes.ok) {
      return { ok: false, message: yearRes.error };
    }
    if (countRes.error) {
      logServerError("class-data-center.countStudents", countRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }
    if (staffingRes.error) {
      logServerError("class-data-center.loadStaffing", staffingRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const klass = classRes.data as unknown as ClassEmbed;
    const gradeName = unwrapOne(klass.grade_levels)?.name?.trim() || "—";
    const schoolYearId = classYearId(klass);
    const schoolYearLabel = unwrapOne(klass.school_years)?.label?.trim() || "";
    const currentYearId = yearRes.year?.id ?? null;
    const studentCount = countRes.count ?? 0;

    const staffMemberIds = [
      ...new Set((staffingRes.data ?? []).map((row) => row.staff_member_id).filter(Boolean)),
    ];
    const staffById = new Map<
      string,
      {
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        role: string | null;
        status: string | null;
        profile_id: string | null;
      }
    >();
    if (staffMemberIds.length > 0) {
      const staffRes = await supabase
        .from("staff_members")
        .select("id, full_name, first_name, last_name, email, role, status, profile_id")
        .in("id", staffMemberIds);
      if (staffRes.error) {
        logServerError("class-data-center.loadStaffMembers", staffRes.error.message);
        return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
      }
      for (const row of staffRes.data ?? []) {
        if (!row?.id) continue;
        staffById.set(row.id, {
          full_name: row.full_name ?? null,
          first_name: row.first_name ?? null,
          last_name: row.last_name ?? null,
          email: row.email ?? null,
          role: row.role ?? null,
          status: row.status ?? null,
          profile_id: row.profile_id ?? null,
        });
      }
    }

    const staffMembers: ClassDataCenterStaffMember[] = [];
    for (const raw of staffingRes.data ?? []) {
      const staff = staffById.get(raw.staff_member_id);
      if (!staff) continue;
      const displayName = formatStaffMemberAssignmentLabel({
        full_name: staff.full_name,
        first_name: staff.first_name,
        last_name: staff.last_name,
        email: staff.email,
        role: staff.role,
      });
      const roleDb = String(raw.role ?? "").trim() || "subject";
      staffMembers.push({
        staffMemberId: raw.staff_member_id,
        displayName,
        roleInClass: formatStaffRoleInClass(roleDb),
        roleInClassDb: roleDb,
        accountStatus: northStarAccountStatusLabel({
          profileId: staff.profile_id,
          staffStatus: staff.status,
        }),
        href: classDataCenterStaffProfileHref(role, raw.staff_member_id),
        profileId: staff.profile_id,
      });
    }

    staffMembers.sort((a, b) => {
      if (a.roleInClassDb === CLASS_TEACHER_ROLE_HOMEROOM) return -1;
      if (b.roleInClassDb === CLASS_TEACHER_ROLE_HOMEROOM) return 1;
      return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
    });

    const homeroom =
      staffMembers.find((s) => s.roleInClassDb === CLASS_TEACHER_ROLE_HOMEROOM) ?? null;
    const additionalTeachers = staffMembers.filter(
      (s) => s.roleInClassDb !== CLASS_TEACHER_ROLE_HOMEROOM,
    );
    const kindLabel = classKindLabelFromHomeroom(Boolean(homeroom));

    return {
      ok: true,
      context: {
        id: klass.id,
        role,
        title: formatClassTitle(klass.name, klass.section),
        gradeName,
        classKindLabel: kindLabel,
        meta: formatClassDataCenterMeta({
          gradeName,
          classKindLabel: kindLabel,
          schoolYearLabel,
        }),
        studentCount,
        schoolYearId,
        schoolYearLabel,
        gradeLevelId: klass.grade_level_id,
        section: klass.section,
        name: klass.name,
        isCurrentYear: classIsCurrentSchoolYear(schoolYearId, currentYearId),
        isActive: klass.is_active !== false,
        homeroom,
        additionalTeachers,
      },
    };
  },
);
