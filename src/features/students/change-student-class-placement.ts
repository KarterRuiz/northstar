import "server-only";

import { logServerError, safeUserFacingMessage } from "@/lib/errors/safe-user-message";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  planStudentClassTransfer,
  type TransferEnrollmentSnapshot,
} from "./transfer-student-enrollment";

type Supabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type ChangeStudentClassPlacementResult =
  | {
      ok: true;
      sourceEnrollmentId: string;
      destinationEnrollmentId: string;
      createdDestination: boolean;
      withdrawnSource: boolean;
      sourceClassId: string;
      destinationClassId: string;
      studentId: string;
    }
  | { ok: false; message: string };

type RpcTransferRow = {
  ok?: boolean;
  sourceEnrollmentId?: string;
  destinationEnrollmentId?: string;
  createdDestination?: boolean;
  withdrawnSource?: boolean;
  sourceClassId?: string;
  destinationClassId?: string;
  studentId?: string;
};

/**
 * Atomically withdraws the source enrollment (class_id unchanged) and ensures
 * an active enrollment in the destination class via Postgres RPC.
 */
export async function changeStudentClassPlacement(
  supabase: Supabase,
  args: {
    enrollmentId: string;
    destinationClassId: string;
  },
): Promise<ChangeStudentClassPlacementResult> {
  const { data: sourceRow, error: sourceErr } = await supabase
    .from("student_enrollments")
    .select("id, student_id, class_id, school_year_id, status, roster_number")
    .eq("id", args.enrollmentId)
    .maybeSingle();

  if (sourceErr) {
    logServerError("students.changeStudentClassPlacement.loadSource", sourceErr.message);
    return {
      ok: false,
      message: safeUserFacingMessage(sourceErr.message, "Could not load the enrollment."),
    };
  }
  if (!sourceRow) {
    return { ok: false, message: "Enrollment record was not found." };
  }

  const source: TransferEnrollmentSnapshot = {
    id: sourceRow.id,
    studentId: sourceRow.student_id,
    classId: sourceRow.class_id,
    schoolYearId: sourceRow.school_year_id,
    status: sourceRow.status,
    rosterNumber: sourceRow.roster_number,
  };

  const { data: destClass, error: destErr } = await supabase
    .from("classes")
    .select("id, school_year_id, is_active")
    .eq("id", args.destinationClassId)
    .maybeSingle();

  if (destErr) {
    logServerError("students.changeStudentClassPlacement.loadDest", destErr.message);
    return {
      ok: false,
      message: safeUserFacingMessage(destErr.message, "Could not load the destination class."),
    };
  }

  const { data: existingDest, error: existingErr } = await supabase
    .from("student_enrollments")
    .select("id")
    .eq("student_id", source.studentId)
    .eq("class_id", args.destinationClassId)
    .eq("status", "active")
    .maybeSingle();

  if (existingErr) {
    logServerError("students.changeStudentClassPlacement.loadExistingDest", existingErr.message);
    return {
      ok: false,
      message: safeUserFacingMessage(
        existingErr.message,
        "Could not check destination enrollment.",
      ),
    };
  }

  const plan = planStudentClassTransfer({
    source,
    destinationClassId: args.destinationClassId,
    destinationClassIsActive: destClass?.is_active === true,
    destinationSchoolYearId: destClass?.school_year_id ?? null,
    existingActiveInDestination: existingDest?.id ? { id: existingDest.id } : null,
  });

  if (plan.kind === "error" || plan.kind === "noop_same_class") {
    return { ok: false, message: plan.message };
  }

  // Defense in depth: planner forbids rewriting class_id; RPC enforces atomicity.
  if (plan.forbidden.updateSourceClassId !== false) {
    return { ok: false, message: "Transfer refused: would rewrite historical class placement." };
  }

  const { data, error } = await supabase.rpc("transfer_student_class_placement", {
    p_enrollment_id: args.enrollmentId,
    p_destination_class_id: args.destinationClassId,
  });

  if (error) {
    logServerError("students.changeStudentClassPlacement.rpc", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(
        error.message,
        "Could not transfer class placement. No partial change was kept.",
      ),
    };
  }

  const row = (data ?? null) as RpcTransferRow | null;
  if (
    !row ||
    row.ok !== true ||
    !row.sourceEnrollmentId ||
    !row.destinationEnrollmentId ||
    !row.sourceClassId ||
    !row.destinationClassId ||
    !row.studentId
  ) {
    return {
      ok: false,
      message: "Transfer did not complete. Try again or refresh the page.",
    };
  }

  return {
    ok: true,
    sourceEnrollmentId: row.sourceEnrollmentId,
    destinationEnrollmentId: row.destinationEnrollmentId,
    createdDestination: Boolean(row.createdDestination),
    withdrawnSource: Boolean(row.withdrawnSource),
    sourceClassId: row.sourceClassId,
    destinationClassId: row.destinationClassId,
    studentId: row.studentId,
  };
}
