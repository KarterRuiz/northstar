/** Domain model for the student profile area — wire to Supabase row shapes later. */

export type StudentDivision = "lower" | "middle" | "upper";

export type StudentEnrollmentStatus =
  | "active"
  | "leave"
  | "graduated"
  | "inactive";

export type StudentProfile = {
  id: string;
  /** Display name */
  fullName: string;
  /** School-facing identifier */
  studentNumber: string;
  division: StudentDivision;
  gradeLevel: string;
  homeroom: string;
  status: StudentEnrollmentStatus;
  /** ISO date string */
  dateOfBirth: string;
  /** Short labels for chips in the header */
  tags: string[];
};

export type GradeRow = {
  id: string;
  courseCode: string;
  courseTitle: string;
  term: string;
  /** e.g. letter or descriptor */
  grade: string;
  performanceLevel: string | null;
  status: string;
  /** ISO date string */
  updatedAt: string;
};

export type ReportCardSummary = {
  id: string;
  academicYear: string;
  termLabel: string;
  /** ISO date string */
  issuedOn: string;
  status: "draft" | "final" | "archive";
  /** One-line summary for list rows */
  headline: string;
};

export type TransitionNoteStatus =
  | "draft"
  | "submitted"
  | "reviewed"
  | "archived"
  | "reopened";

export type TransitionNote = {
  id: string;
  title: string;
  /** ISO timestamp */
  authoredOn: string;
  /** ISO timestamp — last saved update */
  updatedAt: string;
  reviewedAt: string | null;
  archivedAt: string | null;
  authorName: string;
  status: TransitionNoteStatus;
  summary: string;
};

export type StudentFile = {
  id: string;
  label: string;
  category: "consent" | "assessment" | "medical" | "other";
  /** ISO date string */
  uploadedOn: string;
  uploadedBy: string;
  /** Placeholder until Supabase storage metadata exists */
  storageKey: string;
};

export type AuditEvent = {
  id: string;
  /** ISO timestamp string */
  occurredAt: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
};

/** Directory row — backed by Supabase `students` + active `student_enrollments`. */
export type StudentListEntry = {
  id: string;
  fullName: string;
  /** School-facing ID (`external_id`) or em dash when unset */
  studentNumber: string;
  gradeLevel: string;
  classLabel: string;
  /** Enrollment row status, e.g. `active` / `withdrawn` */
  status: string;
};
