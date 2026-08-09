import type { RosterFieldId } from "./field-catalog";

export type ColumnMapping = Partial<Record<RosterFieldId, string | null>>;

export type ParsedRosterFile = {
  headers: string[];
  /** Raw cell values keyed by original header. */
  rows: Record<string, string>[];
  fileName: string;
  format: "csv" | "xlsx";
};

export type MappedRosterRow = {
  rowNumber: number;
  values: Partial<Record<RosterFieldId, string>>;
  raw: Record<string, string>;
};

export type RosterValidationIssueCode =
  | "missing_first_name"
  | "missing_last_name"
  | "missing_class"
  | "missing_required_field"
  | "duplicate_student_number_in_file"
  | "duplicate_external_id_in_file"
  | "unknown_grade"
  | "unknown_class"
  | "student_already_exists"
  | "invalid_email"
  | "invalid_date"
  | "duplicate_student_number_in_system";

export type RosterValidationIssue = {
  rowNumber: number;
  code: RosterValidationIssueCode;
  message: string;
  field?: RosterFieldId;
  severity: "error" | "warning";
};

export type RosterImportOptions = {
  updateExisting: boolean;
  createNew: boolean;
  archiveWithdrawn: boolean;
  createMissingGrades: boolean;
  createMissingClasses: boolean;
};

export const DEFAULT_ROSTER_IMPORT_OPTIONS: RosterImportOptions = {
  updateExisting: true,
  createNew: true,
  archiveWithdrawn: false,
  createMissingGrades: false,
  createMissingClasses: false,
};

export type RosterMatchKind = "new" | "existing" | "class_change" | "unchanged";

export type RosterPlannedRow = {
  rowNumber: number;
  kind: RosterMatchKind;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  externalId: string | null;
  gradeLabel: string | null;
  classLabel: string;
  classId: string | null;
  gradeLevelId: string | null;
  schoolYearId: string | null;
  existingStudentId: string | null;
  existingEnrollmentId: string | null;
  existingClassId: string | null;
  existingClassLabel: string | null;
};

export type RosterImportPlan = {
  rows: RosterPlannedRow[];
  existingCount: number;
  newCount: number;
  classChangeCount: number;
  unchangedCount: number;
  leavingStudents: {
    studentId: string;
    enrollmentId: string;
    fullName: string;
    externalId: string | null;
    classLabel: string;
  }[];
  missingGrades: string[];
  missingClasses: { classLabel: string; gradeLabel: string | null }[];
  issues: RosterValidationIssue[];
  blockingErrorCount: number;
};

export type RosterApplyBatchResult = {
  ok: true;
  processed: number;
  remaining: number;
  added: number;
  updated: number;
  archived: number;
  errors: { rowNumber: number; message: string }[];
  done: boolean;
  cursor: number;
};

export type RosterImportSummary = {
  added: number;
  updated: number;
  archived: number;
  errors: { rowNumber: number; message: string }[];
  gradesCreated: number;
  classesCreated: number;
};

export type RosterContextClass = {
  id: string;
  name: string;
  section: string | null;
  schoolYearId: string;
  gradeLevelId: string;
  gradeName: string;
  gradeCode: string | null;
  label: string;
  isActive: boolean;
};

export type RosterContextGrade = {
  id: string;
  name: string;
  code: string | null;
  sortOrder: number;
  isArchived: boolean;
};

export type RosterContextStudent = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  externalId: string | null;
  enrollmentId: string | null;
  classId: string | null;
  classLabel: string | null;
  enrollmentStatus: string | null;
  schoolYearId: string | null;
};

export type RosterImportContext = {
  schoolYearId: string | null;
  schoolYearLabel: string | null;
  classes: RosterContextClass[];
  grades: RosterContextGrade[];
  students: RosterContextStudent[];
};
