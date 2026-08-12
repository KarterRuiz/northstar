import type { EnrollmentStatusForm } from "@/features/students/enrollment-constants";

export type BulkAddRowDraft = {
  /** Stable client key for React lists. */
  key: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  externalId: string;
  classId: string;
  enrollmentStatus: EnrollmentStatusForm;
};

export type BulkAddField =
  | "firstName"
  | "lastName"
  | "preferredName"
  | "externalId"
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
  externalId: string | null;
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
  externalId: string | null;
  classId: string;
  enrollmentStatus: EnrollmentStatusForm;
};

export type BulkAddCreatedRow = {
  key: string;
  studentId: string;
  firstName: string;
  lastName: string;
  classLabel: string;
  externalId: string | null;
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
