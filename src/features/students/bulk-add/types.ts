import type { EnrollmentStatusForm } from "@/features/students/enrollment-constants";

export type BulkAddRowDraft = {
  /** Immutable client key for React lists — never derived from editable fields. */
  key: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  /** School-wide Student Number (`students.external_id`). Required for create. */
  studentNumber: string;
  /** Class-scoped roster position (string while editing). Not school-wide student #. */
  rosterNumber: string;
  classId: string;
  enrollmentStatus: EnrollmentStatusForm;
};

export type BulkAddField =
  | "firstName"
  | "lastName"
  | "preferredName"
  | "studentNumber"
  | "rosterNumber"
  | "classId"
  | "enrollmentStatus"
  | "row";

export type BulkAddRowIssue = {
  field: BulkAddField;
  message: string;
};

export type BulkAddValidatedRow = {
  key: string;
  rowIndex: number;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  studentNumber: string;
  rosterNumber: number | null;
  classId: string;
  classLabel: string;
  enrollmentStatus: EnrollmentStatusForm;
  schoolYearId: string;
};

export type BulkAddValidationResult = {
  ready: BulkAddValidatedRow[];
  issuesByKey: Record<string, BulkAddRowIssue[]>;
  readyCount: number;
  needsCorrectionCount: number;
  skippedBlankCount: number;
};

export type BulkAddClassOption = {
  id: string;
  schoolYearId: string;
  label: string;
};

export type BulkAddCreateRowInput = {
  key: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  studentNumber: string;
  rosterNumber: number | null;
  classId: string;
  enrollmentStatus: EnrollmentStatusForm;
};

export type BulkAddCreatedRow = {
  key: string;
  studentId: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  classLabel: string;
  rosterNumber: number | null;
  enrollmentStatus: EnrollmentStatusForm;
};

export type BulkAddFailedRow = {
  key: string;
  firstName: string;
  lastName: string;
  message: string;
};

export type BulkAddCreateResult =
  | {
      ok: true;
      created: BulkAddCreatedRow[];
      failed: BulkAddFailedRow[];
      message: string;
    }
  | { ok: false; message: string };
