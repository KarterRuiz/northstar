/**
 * Operational "active student" rule for Northstar.
 *
 * A student is operationally ACTIVE iff they have ≥1 enrollment where:
 *   `student_enrollments.status = 'active'` AND `classes.is_active = true`
 *
 * Cases:
 * - Active enrollment in an active class → operationally active
 * - Active enrollments only in archived classes (`is_active = false`) → NOT operationally active
 * - Multiple enrollments → active if any one satisfies the rule (distinct student)
 *
 * Do NOT withdraw or mutate historical enrollments when a class is archived.
 * Prefer this query-side filter for CURRENT operational lists, counts, and selectors.
 * Class-scoped historical views (archived class pages) may still list enrollments by class_id.
 *
 * Current homeroom placement (which class label to show) uses
 * `resolveCurrentHomeroom` in current-homeroom.ts — at most one active homeroom
 * per student per school year (Option A: all classes are homerooms today).
 *
 * PostgREST pattern when querying enrollments for operational active students:
 * ```
 * .from("student_enrollments")
 * .select("..., classes!inner ( ... )")
 * .eq("status", OPERATIONAL_ACTIVE_ENROLLMENT_STATUS)
 * .eq("classes.is_active", true)
 * ```
 */

/** Enrollment status that participates in the operational-active rule. */
export const OPERATIONAL_ACTIVE_ENROLLMENT_STATUS = "active" as const;

/**
 * Pure check for one enrollment + its class archive flag.
 * Use after loading embeds, or when filtering client-side.
 */
export function isOperationallyActiveEnrollment(args: {
  status: string;
  classIsActive: boolean;
}): boolean {
  return (
    args.status === OPERATIONAL_ACTIVE_ENROLLMENT_STATUS && args.classIsActive
  );
}
