/**
 * Safe class-placement transfer semantics (app-side).
 *
 * Policy for same-student class moves:
 * - NEVER rewrite `student_enrollments.class_id`
 * - Keep Enrollment A with class_id unchanged; set status to withdrawn
 * - Ensure an active Enrollment B in the destination class
 *
 * Status for the vacated enrollment uses the existing check-constraint value
 * `withdrawn` (same as remove-from-class / archive). Do not invent `transferred`.
 */

/** Status applied to the source enrollment when leaving a class via transfer. */
export const TRANSFER_SOURCE_ENROLLMENT_STATUS = "withdrawn" as const;

/** Status for the destination enrollment after a successful transfer. */
export const TRANSFER_DESTINATION_ENROLLMENT_STATUS = "active" as const;

export type TransferEnrollmentSnapshot = {
  id: string;
  studentId: string;
  classId: string;
  schoolYearId: string;
  status: string;
  rosterNumber?: number | null;
};

export type TransferPlan =
  | {
      kind: "noop_same_class";
      message: string;
    }
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "transfer";
      sourceEnrollmentId: string;
      studentId: string;
      sourceClassId: string;
      destinationClassId: string;
      /** Always withdrawn — class_id of source must remain unchanged. */
      sourceStatusAfter: typeof TRANSFER_SOURCE_ENROLLMENT_STATUS;
      /** Create only when destination has no active enrollment. */
      createDestination: boolean;
      existingDestinationEnrollmentId: string | null;
      destinationStatus: typeof TRANSFER_DESTINATION_ENROLLMENT_STATUS;
      /** New destination roster # is null (do not steal source roster_number). */
      destinationRosterNumber: null;
      /** Operations that must NEVER run for a safe transfer. */
      forbidden: {
        updateSourceClassId: false;
        mutateHistoricalAttendance: false;
        mutateHistoricalReportCards: false;
        mutateStudentIdentity: false;
      };
    };

/**
 * Pure planner for transfer outcomes (unit-testable without DB).
 */
export function planStudentClassTransfer(args: {
  source: TransferEnrollmentSnapshot;
  destinationClassId: string;
  destinationClassIsActive: boolean;
  destinationSchoolYearId: string | null;
  existingActiveInDestination: { id: string } | null;
}): TransferPlan {
  const dest = args.destinationClassId.trim();
  if (!dest) {
    return { kind: "error", message: "Pick a destination class." };
  }

  if (args.source.classId === dest) {
    return {
      kind: "noop_same_class",
      message: "Student is already enrolled in that class.",
    };
  }

  if (args.source.status !== "active") {
    return {
      kind: "error",
      message: "Only an active enrollment can be transferred.",
    };
  }

  if (!args.destinationClassIsActive) {
    return {
      kind: "error",
      message: "Destination class is inactive; pick an active class.",
    };
  }

  if (!args.destinationSchoolYearId) {
    return { kind: "error", message: "Destination class was not found." };
  }

  return {
    kind: "transfer",
    sourceEnrollmentId: args.source.id,
    studentId: args.source.studentId,
    sourceClassId: args.source.classId,
    destinationClassId: dest,
    sourceStatusAfter: TRANSFER_SOURCE_ENROLLMENT_STATUS,
    createDestination: args.existingActiveInDestination == null,
    existingDestinationEnrollmentId: args.existingActiveInDestination?.id ?? null,
    destinationStatus: TRANSFER_DESTINATION_ENROLLMENT_STATUS,
    destinationRosterNumber: null,
    forbidden: {
      updateSourceClassId: false,
      mutateHistoricalAttendance: false,
      mutateHistoricalReportCards: false,
      mutateStudentIdentity: false,
    },
  };
}

/** True when edit should run transfer instead of in-place enrollment update. */
export function shouldTransferEnrollment(args: {
  enrollmentId: string | null;
  beforeClassId: string | null;
  nextClassId: string;
}): boolean {
  if (!args.enrollmentId || !args.beforeClassId) return false;
  return args.beforeClassId !== args.nextClassId;
}

export function transferClassConfirmMessage(args: {
  studentDisplayName?: string;
  fromClassLabel: string;
  toClassLabel: string;
}): string {
  const who = args.studentDisplayName?.trim() || "this student";
  return (
    `Transfer ${who} from ${args.fromClassLabel} to ${args.toClassLabel}? ` +
    `The previous enrollment in ${args.fromClassLabel} will be kept as withdrawn ` +
    `(class history preserved). A new active enrollment will be created in ${args.toClassLabel}. ` +
    `Attendance, report cards, and other records tied to the previous class are not moved or deleted.`
  );
}
