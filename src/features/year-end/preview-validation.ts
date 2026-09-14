import {
  dispositionForbidsDestination,
  dispositionRequiresDestination,
  dispositionRequiresReason,
} from "./grade-ladder";
import type {
  ClassRef,
  YearEndBlocker,
  YearEndDisposition,
} from "./types";

export type PreviewItemInput = {
  id: string;
  studentId: string;
  studentNumber: string | null;
  disposition: YearEndDisposition;
  reason: string | null;
  destinationClassId: string | null;
  sourceEnrollmentId: string;
};

export type PreviewContext = {
  toSchoolYearId: string;
  /** Active TO-year classes keyed by id. */
  toYearClassesById: ReadonlyMap<string, ClassRef>;
  /**
   * Student ids that already have an active enrollment in the TO year
   * (any active class). Blocks READY for placement dispositions.
   */
  studentsWithActiveToYearEnrollment: ReadonlySet<string>;
};

/**
 * Collect readiness blockers for plan items. Pure — no I/O.
 */
export function collectPreviewBlockers(
  items: readonly PreviewItemInput[],
  ctx: PreviewContext,
): YearEndBlocker[] {
  const blockers: YearEndBlocker[] = [];

  for (const item of items) {
    const number = (item.studentNumber ?? "").trim();
    if (!number) {
      blockers.push({
        code: "missing_student_number",
        studentId: item.studentId,
        itemId: item.id,
        message: "Student Number is required before READY.",
      });
    }

    if (dispositionRequiresReason(item.disposition)) {
      if (!(item.reason ?? "").trim()) {
        blockers.push({
          code: "custom_reason_required",
          studentId: item.studentId,
          itemId: item.id,
          message: "Custom disposition requires a reason.",
        });
      }
    }

    const destId = item.destinationClassId;

    if (dispositionForbidsDestination(item.disposition)) {
      if (destId) {
        blockers.push({
          code: "destination_not_allowed",
          studentId: item.studentId,
          itemId: item.id,
          message:
            item.disposition === "graduate_primary"
              ? "Graduate Primary must not assign a next-year class."
              : "Leave School must not assign a next-year class.",
        });
      }
      continue;
    }

    if (dispositionRequiresDestination(item.disposition)) {
      if (!destId) {
        blockers.push({
          code: "missing_destination",
          studentId: item.studentId,
          itemId: item.id,
          message: "Promote, Retain, Remap, and Custom require a destination class.",
        });
        continue;
      }

      const dest = ctx.toYearClassesById.get(destId);
      if (!dest) {
        blockers.push({
          code: "wrong_year_destination",
          studentId: item.studentId,
          itemId: item.id,
          message: "Destination class was not found in the next school year.",
        });
        continue;
      }

      if (dest.school_year_id !== ctx.toSchoolYearId) {
        blockers.push({
          code: "wrong_year_destination",
          studentId: item.studentId,
          itemId: item.id,
          message: "Destination class belongs to the wrong school year.",
        });
      }

      if (!dest.is_active) {
        blockers.push({
          code: "inactive_destination",
          studentId: item.studentId,
          itemId: item.id,
          message: "Destination class is archived.",
        });
      }

      if (ctx.studentsWithActiveToYearEnrollment.has(item.studentId)) {
        blockers.push({
          code: "target_year_conflict",
          studentId: item.studentId,
          itemId: item.id,
          message:
            "Student already has an active enrollment in the next school year.",
        });
      }
    }
  }

  return blockers;
}

export type PreviewCounts = {
  total: number;
  promote: number;
  retain: number;
  remap: number;
  graduate_primary: number;
  leave_school: number;
  custom: number;
  withDestination: number;
  withoutDestination: number;
  blockers: number;
};

export function summarizePreview(
  items: readonly PreviewItemInput[],
  blockers: readonly YearEndBlocker[],
): PreviewCounts {
  const counts: PreviewCounts = {
    total: items.length,
    promote: 0,
    retain: 0,
    remap: 0,
    graduate_primary: 0,
    leave_school: 0,
    custom: 0,
    withDestination: 0,
    withoutDestination: 0,
    blockers: blockers.length,
  };

  for (const item of items) {
    counts[item.disposition] += 1;
    if (item.destinationClassId) counts.withDestination += 1;
    else counts.withoutDestination += 1;
  }

  return counts;
}

/** Plan may move to READY only when every item passes validation. */
export function canMarkPlanReady(
  items: readonly PreviewItemInput[],
  blockers: readonly YearEndBlocker[],
): boolean {
  return items.length > 0 && blockers.length === 0;
}
