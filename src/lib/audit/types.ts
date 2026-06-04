/** JSON-serializable metadata values (no Date, Map, bigint). */
export type AuditMetadataPrimitive =
  | string
  | number
  | boolean
  | null
  | AuditMetadataPrimitive[]
  | { [key: string]: AuditMetadataPrimitive };

/**
 * Loose object bag for identifiers and context; keep values JSON-safe.
 */
export type AuditMetadataObject = {
  [key: string]: AuditMetadataPrimitive;
};

export const auditActions = [
  "student_profile_viewed",
  "student_created",
  "student_updated",
  "teacher_student_created",
  "teacher_roster_bulk_created",
  "teacher_student_updated",
  "transition_note_edited",
  "transition_note_drafted",
  "transition_note_submitted",
  "transition_note_reviewed",
  "transition_note_reopened",
  "transition_note_archived",
  "academic_record_created",
  "academic_record_updated",
  "academic_record_submitted",
  "academic_record_reviewed",
  "gradebook_category_created",
  "gradebook_assignment_created",
  "gradebook_assignment_updated",
  "gradebook_assignment_deleted",
  "gradebook_scores_updated",
  "report_card_uploaded",
  "report_card_generated",
  "report_card_downloaded",
  "report_card_archived",
  "report_card_voided",
  "records_exported",
  "grade_changed",
  "class_created",
  "class_archived",
  "class_restored",
  "class_deleted",
  "teacher_assigned",
  "role_updated",
  "profile_status_changed",
  "staff_invited",
  "staff_invite_accepted",
  "staff_profile_linked",
  "parent_request_created",
  "parent_request_updated",
  "parent_request_completed",
  "student_record_exported",
  "intervention_created",
  "intervention_updated",
  "intervention_resolved",
  "intervention_escalated",
] as const;

export type AuditAction = (typeof auditActions)[number];

type BaseAuditFields = {
  /** Authenticated user id when known (maps to `audit_events.actor_id`). */
  actorUserId?: string;
  /** ISO 8601 timestamp; omit to let the database default apply. */
  createdAt?: string;
};

export type AuditEventInput =
  | (BaseAuditFields & {
      action: "student_profile_viewed";
      metadata: { studentId: string } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "student_created";
      metadata: {
        studentId: string;
        classId: string;
        enrollmentStatus: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "student_updated";
      metadata: {
        studentId: string;
        /** Short human-readable summary, e.g. comma-separated changed field keys. */
        changedSummary: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "teacher_student_created";
      metadata: {
        studentId: string;
        classId: string;
        enrollmentStatus: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "teacher_roster_bulk_created";
      metadata: {
        classId: string;
        createdCount: number;
        failedCount: number;
        studentIds?: string[];
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "teacher_student_updated";
      metadata: {
        studentId: string;
        changedSummary: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "transition_note_edited";
      metadata: {
        studentId?: string;
        noteId?: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "transition_note_drafted";
      metadata: {
        studentId: string;
        noteId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "transition_note_submitted";
      metadata: {
        studentId: string;
        noteId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "transition_note_reviewed";
      metadata: {
        studentId: string;
        noteId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "transition_note_reopened";
      metadata: {
        studentId: string;
        noteId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "transition_note_archived";
      metadata: {
        studentId: string;
        noteId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "academic_record_created";
      metadata: {
        studentId: string;
        recordId: string;
        classId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "academic_record_updated";
      metadata: {
        studentId: string;
        recordId: string;
        classId: string;
        changedSummary?: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "academic_record_submitted";
      metadata: {
        studentId: string;
        recordId: string;
        classId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "academic_record_reviewed";
      metadata: {
        studentId: string;
        recordId: string;
        classId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "gradebook_category_created";
      metadata: {
        classId: string;
        categoryId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "gradebook_assignment_created";
      metadata: {
        classId: string;
        assignmentId: string;
        categoryId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "gradebook_assignment_updated";
      metadata: {
        classId: string;
        assignmentId: string;
        categoryId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "gradebook_assignment_deleted";
      metadata: {
        classId: string;
        assignmentId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "gradebook_scores_updated";
      metadata: {
        classId: string;
        assignmentId: string;
        scoreCount: number;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "report_card_uploaded";
      metadata: {
        studentId: string;
        /** Storage key or bucket-relative path after upload. */
        storagePath?: string;
        /** Alternative stable file identifier from storage provider. */
        fileId?: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "report_card_generated";
      metadata: {
        studentId: string;
        storagePath?: string;
        fileId?: string;
        source?: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "report_card_downloaded";
      metadata: {
        fileId: string;
        studentId: string;
        storagePath?: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "report_card_archived";
      metadata: {
        fileId: string;
        studentId: string;
        storagePath?: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "report_card_voided";
      metadata: {
        fileId: string;
        studentId: string;
        storagePath?: string;
        schoolYear?: string;
        term?: string;
        reason?: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "records_exported";
      metadata: { scopeSummary: string } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "grade_changed";
      metadata: {
        studentId: string;
        courseId?: string;
        assignmentId?: string;
        termId?: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "class_created";
      metadata: {
        classId: string;
        schoolYearId: string;
        gradeLevelId: string;
        studentId?: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "class_archived";
      metadata: {
        classId: string;
        schoolYearId: string;
        className: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "class_restored";
      metadata: {
        classId: string;
        schoolYearId: string;
        className: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "class_deleted";
      metadata: {
        classId: string;
        schoolYearId: string;
        className: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "teacher_assigned";
      metadata: {
        classId: string;
        teacherProfileId: string;
        assignmentRole: string;
        studentId?: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "role_updated";
      metadata: {
        targetUserId: string;
        oldRole: string;
        newRole: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "profile_status_changed";
      metadata: {
        targetUserId: string;
        oldActive: boolean;
        newActive: boolean;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "staff_invited";
      metadata: {
        invitationId: string;
        email: string;
        fullName: string;
        role: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "staff_invite_accepted";
      metadata: {
        invitationId: string;
        role: string;
        email: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "staff_profile_linked";
      metadata: {
        invitationId: string;
        acceptedUserId: string;
        role: string;
        previousRole?: string | null;
        invitationEmail?: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "parent_request_created";
      metadata: {
        requestId: string;
        studentId: string;
        status: string;
        documentCount: number;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "parent_request_updated";
      metadata: {
        requestId: string;
        studentId: string;
        status: string;
        previousStatus: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "parent_request_completed";
      metadata: {
        requestId: string;
        studentId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "student_record_exported";
      metadata: {
        studentId: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "intervention_created";
      metadata: {
        studentId: string;
        classId: string;
        interventionId: string;
        interventionType: string;
        status: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "intervention_updated";
      metadata: {
        studentId: string;
        interventionId: string;
        status: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "intervention_resolved";
      metadata: {
        studentId: string;
        interventionId: string;
        status: string;
      } & Record<string, AuditMetadataPrimitive>;
    })
  | (BaseAuditFields & {
      action: "intervention_escalated";
      metadata: {
        studentId: string;
        interventionId: string;
        status: string;
      } & Record<string, AuditMetadataPrimitive>;
    });
