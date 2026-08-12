"use server";

import { revalidatePath } from "next/cache";

import { canManageStudents, isRole, type Role } from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";
import { logServerError, safeUserFacingMessage } from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStudentId } from "@/lib/students/uuid";

import { createStudentRecord } from "@/features/students/create-student-record";
import {
  ENROLLMENT_STATUSES,
  type EnrollmentStatusForm,
} from "@/features/students/enrollment-constants";
import { normalizeMatchKey } from "@/features/students/roster-import/match-helpers";

import { BULK_ADD_EXTERNAL_ID_MAX, BULK_ADD_MAX_ROWS, BULK_ADD_NAME_MAX } from "./constants";
import type {
  BulkAddCreateResult,
  BulkAddCreateRowInput,
  BulkAddCreatedRow,
  BulkAddFailedRow,
} from "./types";

function isUuid(value: string): boolean {
  return isStudentId(value);
}

function parseEnrollmentStatus(raw: string): EnrollmentStatusForm | null {
  const t = raw.trim();
  return (ENROLLMENT_STATUSES as readonly string[]).includes(t)
    ? (t as EnrollmentStatusForm)
    : null;
}

async function authorizeBulkAdd(
  roleRaw: string,
): Promise<
  | { ok: true; userId: string; role: Role }
  | { ok: false; message: string }
> {
  const user = await getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to manage students." };
  }

  const profileRole = await getProfileRole(user.id);
  if (!profileRole || !canManageStudents(profileRole)) {
    return {
      ok: false,
      message: "You do not have permission to create students.",
    };
  }

  if (!isRole(roleRaw) || roleRaw !== profileRole) {
    return { ok: false, message: "Workspace mismatch; refresh the page and try again." };
  }

  return { ok: true, userId: user.id, role: profileRole };
}

/**
 * Creates all provided rows using the shared student+enrollment path.
 * Policy: caller should only submit validated rows. Invalid payload fields
 * are skipped with a row-level failure (no silent create of bad data).
 * Partial success is returned when some rows fail unexpectedly mid-batch.
 */
export async function createBulkStudentsAction(input: {
  dashboardRole: string;
  rows: BulkAddCreateRowInput[];
}): Promise<BulkAddCreateResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const auth = await authorizeBulkAdd(input.dashboardRole);
  if (!auth.ok) return auth;

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    return { ok: false, message: "Add at least one student before creating." };
  }
  if (input.rows.length > BULK_ADD_MAX_ROWS) {
    return {
      ok: false,
      message: `You can create at most ${BULK_ADD_MAX_ROWS} students at once. Use Import roster for larger sets.`,
    };
  }

  const supabase = await createServerSupabaseClient();

  const classIds = [...new Set(input.rows.map((r) => r.classId).filter(Boolean))];
  const { data: classRows, error: classError } = await supabase
    .from("classes")
    .select("id, school_year_id, is_active, name, section, grade_levels ( name ), school_years ( label )")
    .in("id", classIds)
    .eq("is_active", true);

  if (classError) {
    logServerError("bulk-add.loadClasses", classError.message);
    return {
      ok: false,
      message: safeUserFacingMessage(
        classError.message,
        "Could not verify classes. Try again.",
      ),
    };
  }

  type ClassEmbed = {
    id: string;
    school_year_id: string;
    is_active: boolean | null;
    name: string;
    section: string | null;
    grade_levels: { name: string } | { name: string }[] | null;
    school_years: { label: string } | { label: string }[] | null;
  };

  const classById = new Map<string, { schoolYearId: string; label: string }>();
  for (const raw of (classRows ?? []) as unknown as ClassEmbed[]) {
    const gl = Array.isArray(raw.grade_levels) ? raw.grade_levels[0] : raw.grade_levels;
    const sy = Array.isArray(raw.school_years) ? raw.school_years[0] : raw.school_years;
    const grade = gl?.name?.trim() || "—";
    const base = raw.name?.trim() || "Class";
    const sec = raw.section?.trim();
    const klass = sec ? `${base} · ${sec}` : base;
    const year = sy?.label?.trim() || "—";
    classById.set(raw.id, {
      schoolYearId: raw.school_year_id,
      label: `${grade} · ${klass} · ${year}`,
    });
  }

  const externalIds = input.rows
    .map((r) => r.externalId?.trim())
    .filter((v): v is string => Boolean(v));

  const existingExternal = new Set<string>();
  if (externalIds.length > 0) {
    const { data: existingStudents, error: existingError } = await supabase
      .from("students")
      .select("external_id")
      .in("external_id", externalIds);

    if (existingError) {
      logServerError("bulk-add.loadExternalIds", existingError.message);
      return {
        ok: false,
        message: safeUserFacingMessage(
          existingError.message,
          "Could not check existing student numbers. Try again.",
        ),
      };
    }

    for (const s of existingStudents ?? []) {
      if (s.external_id) {
        existingExternal.add(normalizeMatchKey(s.external_id));
      }
    }
  }

  const seenExternal = new Set<string>();
  const created: BulkAddCreatedRow[] = [];
  const failed: BulkAddFailedRow[] = [];

  for (const row of input.rows) {
    const firstName = row.firstName?.trim() ?? "";
    const lastName = row.lastName?.trim() ?? "";
    const preferredName = row.preferredName?.trim()
      ? row.preferredName.trim().slice(0, BULK_ADD_NAME_MAX)
      : null;
    const externalId = row.externalId?.trim()
      ? row.externalId.trim().slice(0, BULK_ADD_EXTERNAL_ID_MAX)
      : null;
    const classId = row.classId?.trim() ?? "";
    const status = parseEnrollmentStatus(String(row.enrollmentStatus ?? ""));

    const fail = (message: string) => {
      failed.push({
        key: row.key,
        firstName: firstName || "(missing)",
        lastName: lastName || "(missing)",
        message,
      });
    };

    if (!firstName || firstName.length > BULK_ADD_NAME_MAX) {
      fail("First name is required.");
      continue;
    }
    if (!lastName || lastName.length > BULK_ADD_NAME_MAX) {
      fail("Last name is required.");
      continue;
    }
    if (!isUuid(classId) || !classById.has(classId)) {
      fail("Selected class is inactive or unavailable.");
      continue;
    }
    if (!status) {
      fail("Pick a valid enrollment status.");
      continue;
    }
    if (externalId) {
      const key = normalizeMatchKey(externalId);
      if (seenExternal.has(key)) {
        fail("Student number is duplicated in this batch.");
        continue;
      }
      if (existingExternal.has(key)) {
        fail("That student number is already used by an existing student.");
        continue;
      }
      seenExternal.add(key);
    }

    const klass = classById.get(classId)!;
    const result = await createStudentRecord(supabase, {
      firstName,
      lastName,
      preferredName,
      externalId,
      classId,
      schoolYearId: klass.schoolYearId,
      enrollmentStatus: status,
      actorUserId: auth.userId,
      auditAction: "student_created",
    });

    if (!result.ok) {
      fail(result.message);
      continue;
    }

    if (externalId) {
      existingExternal.add(normalizeMatchKey(externalId));
    }

    created.push({
      key: row.key,
      studentId: result.studentId,
      firstName,
      lastName,
      classLabel: klass.label,
      externalId,
      enrollmentStatus: status,
    });
  }

  if (created.length > 0) {
    revalidatePath(`/dashboard/${auth.role}/students`, "page");
    for (const row of created) {
      revalidatePath(`/dashboard/${auth.role}/students/${row.studentId}`, "layout");
    }
  }

  if (created.length === 0 && failed.length > 0) {
    return {
      ok: false,
      message:
        failed.length === 1
          ? failed[0]!.message
          : `Could not create students. ${failed.length} rows need attention.`,
    };
  }

  const message =
    failed.length === 0
      ? `Created ${created.length} student${created.length === 1 ? "" : "s"}.`
      : `Created ${created.length} student${created.length === 1 ? "" : "s"}; ${failed.length} could not be created.`;

  return { ok: true, created, failed, message };
}
