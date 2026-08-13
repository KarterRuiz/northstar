/**
 * Pure semantics for teacher operational class mutations.
 * Mirrors SQL `teacher_is_assigned_to_class`:
 * access (assignment and/or grade-level) AND `classes.is_active = true`.
 *
 * Historical READ may use `teacher_can_access_class` without the active gate.
 * Mutations (attendance, gradebook, roster writes) must use this rule.
 */
export function teacherMayPerformClassMutation(args: {
  hasClassAccess: boolean;
  classIsActive: boolean;
}): boolean {
  return args.hasClassAccess && args.classIsActive;
}

export function teacherClassMutationDeniedMessage(args: {
  /** Visible class row with is_active === false (teacher can still SELECT). */
  classIsArchived: boolean;
}): string {
  if (args.classIsArchived) {
    return "This class is archived and cannot be modified.";
  }
  return "You are not assigned to this class.";
}
