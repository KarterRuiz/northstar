import {
  ENROLLMENT_STATUSES,
  type EnrollmentStatusForm,
} from "@/features/students/enrollment-constants";
import {
  createBulkAddRowKey,
  parseRosterNumberInput,
} from "@/features/students/roster-order";
import {
  parseStudentNumber,
  STUDENT_NUMBER_DUPLICATE_MESSAGE,
  studentNumberMatchKey,
} from "@/features/students/student-number";

import { BULK_ADD_NAME_MAX } from "./constants";
import type {
  BulkAddClassOption,
  BulkAddRowDraft,
  BulkAddRowIssue,
  BulkAddValidatedRow,
  BulkAddValidationResult,
} from "./types";

function trimOptional(raw: string, max: number): string | null {
  const t = raw.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function parseEnrollmentStatus(raw: string): EnrollmentStatusForm | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return (ENROLLMENT_STATUSES as readonly string[]).includes(t)
    ? (t as EnrollmentStatusForm)
    : null;
}

function isBlankRow(row: BulkAddRowDraft): boolean {
  return (
    !row.firstName.trim() &&
    !row.lastName.trim() &&
    !row.preferredName.trim() &&
    !row.studentNumber.trim() &&
    !row.rosterNumber.trim() &&
    !row.classId.trim()
  );
}

/**
 * Validates non-blank grid rows. Blank rows are skipped.
 * Policy: ready rows are fully valid; invalid rows must be corrected before create.
 * Student Number is required and unique within the batch (school-wide uniqueness
 * is enforced again at insert).
 */
export function validateBulkAddRows(
  rows: BulkAddRowDraft[],
  options: ValidateBulkRowsOptions,
): BulkAddValidationResult {
  const classById = new Map(options.classOptions.map((c) => [c.id, c]));
  const issuesByKey: Record<string, BulkAddRowIssue[]> = {};
  const ready: BulkAddValidatedRow[] = [];
  let skippedBlankCount = 0;

  const seenRosterInBatch = new Map<string, number>();
  const seenStudentNumber = new Map<string, number>();
  const existingNumbers = options.existingStudentNumbers ?? new Set<string>();

  rows.forEach((row, index) => {
    if (isBlankRow(row)) {
      skippedBlankCount += 1;
      return;
    }

    const issues: BulkAddRowIssue[] = [];
    const firstName = row.firstName.trim();
    const lastName = row.lastName.trim();
    const preferredName = trimOptional(row.preferredName, BULK_ADD_NAME_MAX);
    const classId = row.classId.trim();
    const status = parseEnrollmentStatus(row.enrollmentStatus);
    const rosterParsed = parseRosterNumberInput(row.rosterNumber);
    const rosterNumber = rosterParsed.ok ? rosterParsed.value : null;
    const numberParsed = parseStudentNumber(row.studentNumber);

    if (!firstName) {
      issues.push({ field: "firstName", message: "First name is required." });
    } else if (firstName.length > BULK_ADD_NAME_MAX) {
      issues.push({
        field: "firstName",
        message: `First name must be at most ${BULK_ADD_NAME_MAX} characters.`,
      });
    }

    if (!lastName) {
      issues.push({ field: "lastName", message: "Last name is required." });
    } else if (lastName.length > BULK_ADD_NAME_MAX) {
      issues.push({
        field: "lastName",
        message: `Last name must be at most ${BULK_ADD_NAME_MAX} characters.`,
      });
    }

    if (row.preferredName.trim().length > BULK_ADD_NAME_MAX) {
      issues.push({
        field: "preferredName",
        message: `Preferred name must be at most ${BULK_ADD_NAME_MAX} characters.`,
      });
    }

    if (!numberParsed.ok) {
      issues.push({ field: "studentNumber", message: numberParsed.message });
    } else {
      const key = studentNumberMatchKey(numberParsed.value);
      const prior = seenStudentNumber.get(key);
      if (prior != null) {
        issues.push({
          field: "studentNumber",
          message: `Student Number is duplicated in this batch (also on row ${prior}).`,
        });
      } else {
        seenStudentNumber.set(key, index + 1);
      }
      if (existingNumbers.has(key)) {
        issues.push({
          field: "studentNumber",
          message: STUDENT_NUMBER_DUPLICATE_MESSAGE,
        });
      }
    }

    if (!rosterParsed.ok) {
      issues.push({ field: "rosterNumber", message: rosterParsed.message });
    }

    if (!classId) {
      issues.push({ field: "classId", message: "Class is required." });
    } else if (!classById.has(classId)) {
      issues.push({
        field: "classId",
        message: "Selected class is inactive or unavailable.",
      });
    }

    if (!status) {
      issues.push({
        field: "enrollmentStatus",
        message: "Pick a valid enrollment status.",
      });
    }

    if (rosterParsed.ok && rosterNumber != null && classId) {
      const batchKey = `${classId}:${rosterNumber}`;
      const prior = seenRosterInBatch.get(batchKey);
      if (prior != null) {
        issues.push({
          field: "rosterNumber",
          message: `Roster # ${rosterNumber} is already used in this class (also on row ${prior}).`,
        });
      } else {
        seenRosterInBatch.set(batchKey, index + 1);
      }

      const existing = options.existingRosterByClass?.get(classId);
      if (existing?.has(rosterNumber)) {
        issues.push({
          field: "rosterNumber",
          message: `Roster # ${rosterNumber} is already used in this class.`,
        });
      }
    }

    if (issues.length > 0) {
      issuesByKey[row.key] = issues;
      return;
    }

    if (!numberParsed.ok || !status) {
      issuesByKey[row.key] = [
        ...(issuesByKey[row.key] ?? []),
        { field: "row", message: "Row failed validation." },
      ];
      return;
    }

    const klass = classById.get(classId)!;
    ready.push({
      key: row.key,
      rowIndex: index + 1,
      firstName,
      lastName,
      preferredName,
      studentNumber: numberParsed.value,
      rosterNumber,
      classId,
      classLabel: klass.label,
      enrollmentStatus: status,
      schoolYearId: klass.schoolYearId,
    });
  });

  return {
    ready,
    issuesByKey,
    readyCount: ready.length,
    needsCorrectionCount: Object.keys(issuesByKey).length,
    skippedBlankCount,
  };
}

export type ValidateBulkRowsOptions = {
  classOptions: BulkAddClassOption[];
  /** Optional: existing active roster numbers already in each class (classId → set). */
  existingRosterByClass?: Map<string, Set<number>>;
  /**
   * Optional: match keys (`studentNumberMatchKey`) of Student Numbers already in Northstar.
   * Used to reject creates that would collide before hitting the DB.
   */
  existingStudentNumbers?: Set<string>;
};

export function createEmptyBulkAddRow(
  key: string = createBulkAddRowKey(),
  defaults?: { classId?: string },
): BulkAddRowDraft {
  return {
    key,
    firstName: "",
    lastName: "",
    preferredName: "",
    studentNumber: "",
    rosterNumber: "",
    classId: defaults?.classId ?? "",
    enrollmentStatus: "active",
  };
}

export function isBulkAddRowBlank(row: BulkAddRowDraft): boolean {
  return isBlankRow(row);
}

export function isBulkAddRowPopulated(row: BulkAddRowDraft): boolean {
  return !isBlankRow(row);
}

/** Asserts every row key is unique — used by regression tests. */
export function bulkAddRowKeysAreUnique(rows: BulkAddRowDraft[]): boolean {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.key)) return false;
    seen.add(row.key);
  }
  return true;
}
