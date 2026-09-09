import { normalizeMatchKey } from "@/features/students/roster-import/match-helpers";
import {
  ENROLLMENT_STATUSES,
  type EnrollmentStatusForm,
} from "@/features/students/enrollment-constants";
import {
  createBulkAddRowKey,
  parseRosterNumberInput,
} from "@/features/students/roster-order";

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
    !row.rosterNumber.trim() &&
    !row.classId.trim()
  );
}

function identityKey(row: {
  firstName: string;
  lastName: string;
  preferredName: string | null;
  rosterNumber: number | null;
  classId: string;
  enrollmentStatus: string;
}): string {
  return [
    normalizeMatchKey(row.firstName),
    normalizeMatchKey(row.lastName),
    normalizeMatchKey(row.preferredName ?? ""),
    row.rosterNumber == null ? "" : String(row.rosterNumber),
    row.classId,
    row.enrollmentStatus,
  ].join("|");
}

export type ValidateBulkRowsOptions = {
  classOptions: BulkAddClassOption[];
  /** Optional: existing active roster numbers already in each class (classId → set). */
  existingRosterByClass?: Map<string, Set<number>>;
};

/**
 * Validates non-blank grid rows. Blank rows are skipped.
 * Policy: ready rows are fully valid; invalid rows must be corrected before create.
 * Does not live-sort the draft grid.
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
  const seenIdentity = new Map<string, number>();

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

    if (firstName && lastName && classId && status && rosterParsed.ok) {
      const idKey = identityKey({
        firstName,
        lastName,
        preferredName,
        rosterNumber,
        classId,
        enrollmentStatus: status,
      });
      const prior = seenIdentity.get(idKey);
      if (prior != null) {
        issues.push({
          field: "row",
          message: `This row repeats the same student details as row ${prior}.`,
        });
      } else {
        seenIdentity.set(idKey, index + 1);
      }
    }

    if (issues.length > 0) {
      issuesByKey[row.key] = issues;
      return;
    }

    const klass = classById.get(classId)!;
    ready.push({
      key: row.key,
      rowIndex: index + 1,
      firstName,
      lastName,
      preferredName,
      rosterNumber,
      classId,
      classLabel: klass.label,
      enrollmentStatus: status!,
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

export function createEmptyBulkAddRow(
  key: string = createBulkAddRowKey(),
  defaults?: { classId?: string },
): BulkAddRowDraft {
  return {
    key,
    firstName: "",
    lastName: "",
    preferredName: "",
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
