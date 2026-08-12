import { normalizeMatchKey } from "@/features/students/roster-import/match-helpers";
import {
  ENROLLMENT_STATUSES,
  type EnrollmentStatusForm,
} from "@/features/students/enrollment-constants";

import {
  BULK_ADD_EXTERNAL_ID_MAX,
  BULK_ADD_NAME_MAX,
} from "./constants";
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
    !row.externalId.trim() &&
    !row.classId.trim()
  );
}

function identityKey(row: {
  firstName: string;
  lastName: string;
  preferredName: string | null;
  externalId: string | null;
  classId: string;
  enrollmentStatus: string;
}): string {
  return [
    normalizeMatchKey(row.firstName),
    normalizeMatchKey(row.lastName),
    normalizeMatchKey(row.preferredName ?? ""),
    normalizeMatchKey(row.externalId ?? ""),
    row.classId,
    row.enrollmentStatus,
  ].join("|");
}

export type ValidateBulkRowsOptions = {
  classOptions: BulkAddClassOption[];
  /** Normalized (lowercase) external IDs already in the system. */
  existingExternalIds: Set<string>;
};

/**
 * Validates non-blank grid rows. Blank rows are skipped.
 * Policy: ready rows are fully valid; invalid rows must be corrected before create.
 */
export function validateBulkAddRows(
  rows: BulkAddRowDraft[],
  options: ValidateBulkRowsOptions,
): BulkAddValidationResult {
  const classById = new Map(options.classOptions.map((c) => [c.id, c]));
  const issuesByKey: Record<string, BulkAddRowIssue[]> = {};
  const ready: BulkAddValidatedRow[] = [];
  let skippedBlankCount = 0;

  const seenExternal = new Map<string, number>();
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
    const externalIdRaw = row.externalId.trim();
    const externalId = externalIdRaw
      ? externalIdRaw.slice(0, BULK_ADD_EXTERNAL_ID_MAX)
      : null;
    const classId = row.classId.trim();
    const status = parseEnrollmentStatus(row.enrollmentStatus);

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

    if (externalIdRaw.length > BULK_ADD_EXTERNAL_ID_MAX) {
      issues.push({
        field: "externalId",
        message: `Student number must be at most ${BULK_ADD_EXTERNAL_ID_MAX} characters.`,
      });
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

    if (externalId) {
      const key = normalizeMatchKey(externalId);
      const prior = seenExternal.get(key);
      if (prior != null) {
        issues.push({
          field: "externalId",
          message: `Student number is duplicated in this batch (also on row ${prior}).`,
        });
      } else {
        seenExternal.set(key, index + 1);
      }

      if (options.existingExternalIds.has(key)) {
        issues.push({
          field: "externalId",
          message: "That student number is already used by an existing student.",
        });
      }
    }

    if (firstName && lastName && classId && status) {
      const idKey = identityKey({
        firstName,
        lastName,
        preferredName,
        externalId,
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
      externalId,
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

export function createEmptyBulkAddRow(key: string): BulkAddRowDraft {
  return {
    key,
    firstName: "",
    lastName: "",
    preferredName: "",
    externalId: "",
    classId: "",
    enrollmentStatus: "active",
  };
}

export function isBulkAddRowBlank(row: BulkAddRowDraft): boolean {
  return isBlankRow(row);
}

export function isBulkAddRowPopulated(row: BulkAddRowDraft): boolean {
  return !isBlankRow(row);
}
