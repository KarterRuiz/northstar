/**
 * Homeroom integrity — Phase A (Option A).
 *
 * Today every `classes` row is treated as a Primary homeroom. Rule:
 *   at most ONE active enrollment per (student_id, school_year_id)
 *
 * "Current homeroom" (operational display) additionally requires the class
 * to be active (`classes.is_active = true`). Active-in-archived does not
 * count as current placement (see active-student-enrollments.ts).
 *
 * When specialist/subject memberships arrive, introduce minimal `class_type`
 * and narrow uniqueness + `isHomeroomClass` to homeroom rows only — do not
 * keep a global one-active-enrollment rule after that.
 */

import { isOperationallyActiveEnrollment } from "@/features/students/active-student-enrollments";

export const ACTIVE_HOMEROOM_CONFLICT_MESSAGE =
  "This student already has an active homeroom for this school year.";

export const HOMEROOM_NOT_ASSIGNED_LABEL = "Not assigned";

/**
 * Option A: all classes are homerooms until `class_type` exists.
 * Extension point for CASE I (specialist memberships).
 */
export function isHomeroomClass(klass?: {
  classType?: string | null;
} | null): boolean {
  const t = klass?.classType?.trim();
  if (!t) return true;
  return t === "homeroom";
}

export type HomeroomEnrollmentInput = {
  id: string;
  classId: string;
  schoolYearId: string;
  status: string;
  classIsActive: boolean;
  classLabel: string;
  gradeLabel?: string;
  /** Optional — when class_type exists on classes. */
  classType?: string | null;
  createdAt?: string | null;
};

export type CurrentHomeroomResolution =
  | {
      kind: "assigned";
      enrollment: HomeroomEnrollmentInput;
      /** True when >1 operationally active homeroom (integrity conflict). */
      conflict: false;
    }
  | {
      kind: "conflict";
      enrollments: HomeroomEnrollmentInput[];
      /** Deterministic pick for teacher/simple views only. */
      preferred: HomeroomEnrollmentInput;
      conflict: true;
    }
  | { kind: "not_assigned"; conflict: false };

function compareHomeroomLabel(a: HomeroomEnrollmentInput, b: HomeroomEnrollmentInput): number {
  const byLabel = a.classLabel.localeCompare(b.classLabel, undefined, {
    sensitivity: "base",
  });
  if (byLabel !== 0) return byLabel;
  return a.id.localeCompare(b.id);
}

/**
 * Deterministic current-homeroom resolution from already-loaded enrollments.
 *
 * @param schoolYearId When set, only consider that year (preferred for
 *   "current placement"). When omitted, all years' operational actives compete
 *   (legacy multi-year surfaces).
 */
export function resolveCurrentHomeroom(
  enrollments: readonly HomeroomEnrollmentInput[],
  options?: { schoolYearId?: string | null },
): CurrentHomeroomResolution {
  const yearFilter = options?.schoolYearId?.trim() || null;

  const operational = enrollments.filter((e) => {
    if (yearFilter && e.schoolYearId !== yearFilter) return false;
    if (!isHomeroomClass({ classType: e.classType })) return false;
    return isOperationallyActiveEnrollment({
      status: e.status,
      classIsActive: e.classIsActive,
    });
  });

  if (operational.length === 0) {
    return { kind: "not_assigned", conflict: false };
  }

  const ranked = [...operational].sort(compareHomeroomLabel);
  const preferred = ranked[0]!;

  if (ranked.length === 1) {
    return { kind: "assigned", enrollment: preferred, conflict: false };
  }

  return {
    kind: "conflict",
    enrollments: ranked,
    preferred,
    conflict: true,
  };
}

/** Display label for operational views. */
export function formatHomeroomDisplay(
  resolution: CurrentHomeroomResolution,
  options?: { forAdmin?: boolean },
): string {
  if (resolution.kind === "not_assigned") {
    return HOMEROOM_NOT_ASSIGNED_LABEL;
  }
  if (resolution.kind === "conflict" && options?.forAdmin) {
    return `Integrity: ${resolution.enrollments.length} active homerooms`;
  }
  if (resolution.kind === "conflict") {
    return resolution.preferred.classLabel;
  }
  return resolution.enrollment.classLabel;
}

/**
 * Pure guard: would activating/creating this enrollment create a second
 * active homeroom in the same school year?
 */
export function wouldCreateActiveHomeroomConflict(args: {
  schoolYearId: string;
  /** Enrollment being created/reactivated (exclude from conflict set). */
  excludeEnrollmentId?: string | null;
  /** Existing active (status=active) enrollments for this student — any class archive state. */
  existingActiveInYear: readonly {
    id: string;
    schoolYearId: string;
    status: string;
    classType?: string | null;
  }[];
}): boolean {
  const year = args.schoolYearId.trim();
  if (!year) return false;

  return args.existingActiveInYear.some((e) => {
    if (e.status !== "active") return false;
    if (e.schoolYearId !== year) return false;
    if (!isHomeroomClass({ classType: e.classType })) return false;
    if (args.excludeEnrollmentId && e.id === args.excludeEnrollmentId) {
      return false;
    }
    return true;
  });
}

/** Map unique-violation / app conflict to the stable user-facing message. */
export function activeHomeroomConflictMessage(raw?: string | null): string {
  const msg = raw ?? "";
  if (
    msg.includes("student_enrollments_one_active_homeroom_per_year_uidx") ||
    msg.includes(ACTIVE_HOMEROOM_CONFLICT_MESSAGE)
  ) {
    return ACTIVE_HOMEROOM_CONFLICT_MESSAGE;
  }
  return ACTIVE_HOMEROOM_CONFLICT_MESSAGE;
}
