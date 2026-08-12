import type { RosterFieldId } from "./field-catalog";

export type ColumnMapping = Partial<Record<RosterFieldId, string | null>>;

export type MappingOrigin = "auto" | "manual";

/** Tracks whether each mapped field came from auto-match or the admin. */
export type ColumnMappingOrigins = Partial<Record<RosterFieldId, MappingOrigin>>;

export type HeaderRowCandidate = {
  /** 1-based spreadsheet row number for display. */
  rowNumber: number;
  /** 0-based index into `matrix`. */
  rowIndex: number;
  preview: string[];
  score: number;
  aliasHits: number;
  requiredHits: number;
};

export type SheetCandidate = {
  name: string;
  score: number;
  rowCount: number;
  preview: string;
};

export type ParsedRosterFile = {
  headers: string[];
  /** Raw cell values keyed by original header. */
  rows: Record<string, string>[];
  fileName: string;
  format: "csv" | "xlsx";
  /** Full sheet matrix (strings) so the admin can change the header row. */
  matrix: string[][];
  /** 0-based header row index within `matrix`. */
  headerRowIndex: number;
  /** 1-based header row number for display. */
  headerRowNumber: number;
  headerDetectionConfidence: "high" | "medium" | "low";
  headerCandidates: HeaderRowCandidate[];
  needsHeaderRowSelection: boolean;
  sheetName: string;
  availableSheets: SheetCandidate[];
  sheetSelectionConfidence: "high" | "medium" | "low";
  needsSheetSelection: boolean;
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
