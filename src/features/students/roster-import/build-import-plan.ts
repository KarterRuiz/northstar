import { getRosterField } from "./field-catalog";
import {
  findClassByLabel,
  findGradeByLabel,
  indexStudentsByExternalId,
  normalizeMatchKey,
  resolveExternalId,
  resolvePreferredName,
  validateDateOfBirth,
  validateEmailList,
} from "./match-helpers";
import type {
  MappedRosterRow,
  RosterImportContext,
  RosterImportOptions,
  RosterImportPlan,
  RosterPlannedRow,
  RosterValidationIssue,
} from "./types";

export function buildRosterImportPlan(
  mappedRows: MappedRosterRow[],
  context: RosterImportContext,
  options: RosterImportOptions,
): RosterImportPlan {
  const issues: RosterValidationIssue[] = [];
  const planned: RosterPlannedRow[] = [];
  const byExternal = indexStudentsByExternalId(context.students);
  const seenExternal = new Map<string, number>();
  const rosterStudentIds = new Set<string>();

  const missingGradeSet = new Set<string>();
  const missingClassMap = new Map<string, { classLabel: string; gradeLabel: string | null }>();

  for (const row of mappedRows) {
    const firstName = row.values.first_name?.trim() ?? "";
    const lastName = row.values.last_name?.trim() ?? "";
    const classLabel = row.values.class?.trim() ?? "";
    const gradeLabel = row.values.grade?.trim() || null;
    const preferredName = resolvePreferredName(row.values);
    const externalId = resolveExternalId(row.values);

    if (!firstName) {
      issues.push({
        rowNumber: row.rowNumber,
        code: "missing_first_name",
        message: "First name is required.",
        field: "first_name",
        severity: "error",
      });
    } else if (firstName.length > 120) {
      issues.push({
        rowNumber: row.rowNumber,
        code: "missing_required_field",
        message: "First name must be at most 120 characters.",
        field: "first_name",
        severity: "error",
      });
    }

    if (!lastName) {
      issues.push({
        rowNumber: row.rowNumber,
        code: "missing_last_name",
        message: "Last name is required.",
        field: "last_name",
        severity: "error",
      });
    } else if (lastName.length > 120) {
      issues.push({
        rowNumber: row.rowNumber,
        code: "missing_required_field",
        message: "Last name must be at most 120 characters.",
        field: "last_name",
        severity: "error",
      });
    }

    if (!classLabel) {
      issues.push({
        rowNumber: row.rowNumber,
        code: "missing_class",
        message: "Class is required.",
        field: "class",
        severity: "error",
      });
    }

    if (!externalId) {
      issues.push({
        rowNumber: row.rowNumber,
        code: "missing_required_field",
        message: "Student Number is required.",
        field: "student_number",
        severity: "error",
      });
    } else {
      const key = normalizeMatchKey(externalId);
      const prior = seenExternal.get(key);
      if (prior != null) {
        issues.push({
          rowNumber: row.rowNumber,
          code: "duplicate_student_number_in_file",
          message: `Student Number "${externalId}" is duplicated (also on row ${prior}).`,
          field: "student_number",
          severity: "error",
        });
      } else {
        seenExternal.set(key, row.rowNumber);
      }
    }

    if (row.values.parent_emails) {
      const emailErr = validateEmailList(row.values.parent_emails);
      if (emailErr) {
        issues.push({
          rowNumber: row.rowNumber,
          code: "invalid_email",
          message: emailErr,
          field: "parent_emails",
          severity: "error",
        });
      }
    }

    if (row.values.date_of_birth) {
      const dateErr = validateDateOfBirth(row.values.date_of_birth);
      if (dateErr) {
        issues.push({
          rowNumber: row.rowNumber,
          code: "invalid_date",
          message: dateErr,
          field: "date_of_birth",
          severity: "error",
        });
      }
    }

    const grade = findGradeByLabel(context.grades, gradeLabel);
    if (gradeLabel && !grade) {
      if (options.createMissingGrades) {
        missingGradeSet.add(gradeLabel.trim());
      } else {
        issues.push({
          rowNumber: row.rowNumber,
          code: "unknown_grade",
          message: `Grade "${gradeLabel}" was not found. Create it in School settings, or enable auto-create on the next step.`,
          field: "grade",
          severity: "error",
        });
      }
    }

    const matchedClass = findClassByLabel(
      context.classes,
      classLabel,
      gradeLabel,
      context.schoolYearId,
    );

    if (classLabel && !matchedClass) {
      if (options.createMissingClasses) {
        const mk = `${gradeLabel ?? ""}||${classLabel}`.toLowerCase();
        if (!missingClassMap.has(mk)) {
          missingClassMap.set(mk, {
            classLabel,
            gradeLabel,
          });
        }
      } else {
        issues.push({
          rowNumber: row.rowNumber,
          code: "unknown_class",
          message: `Class "${classLabel}" was not found${gradeLabel ? ` for grade "${gradeLabel}"` : ""}. Create it first, or enable auto-create on the next step.`,
          field: "class",
          severity: "error",
        });
      }
    }

    const existing = externalId
      ? byExternal.get(normalizeMatchKey(externalId)) ?? null
      : null;

    if (existing) {
      rosterStudentIds.add(existing.id);
      issues.push({
        rowNumber: row.rowNumber,
        code: "student_already_exists",
        message: `Student Number "${externalId}" already exists (${existing.firstName} ${existing.lastName}). Will match that record instead of creating a duplicate.`,
        field: "student_number",
        severity: "warning",
      });
    }

    let kind: RosterPlannedRow["kind"] = "new";
    if (existing) {
      if (
        existing.classId &&
        matchedClass &&
        existing.classId !== matchedClass.id
      ) {
        kind = "class_change";
      } else if (
        existing.firstName === firstName &&
        existing.lastName === lastName &&
        (existing.preferredName ?? "") === (preferredName ?? "") &&
        (!matchedClass || existing.classId === matchedClass.id)
      ) {
        kind = "unchanged";
      } else {
        kind = "existing";
      }
    }

    planned.push({
      rowNumber: row.rowNumber,
      kind,
      firstName,
      lastName,
      preferredName,
      externalId,
      gradeLabel,
      classLabel,
      classId: matchedClass?.id ?? null,
      gradeLevelId: matchedClass?.gradeLevelId ?? grade?.id ?? null,
      schoolYearId: matchedClass?.schoolYearId ?? context.schoolYearId,
      existingStudentId: existing?.id ?? null,
      existingEnrollmentId: existing?.enrollmentId ?? null,
      existingClassId: existing?.classId ?? null,
      existingClassLabel: existing?.classLabel ?? null,
    });
  }

  const leavingStudents: RosterImportPlan["leavingStudents"] = [];
  if (context.schoolYearId) {
    for (const s of context.students) {
      if (!s.enrollmentId || !s.classId) continue;
      if (s.schoolYearId !== context.schoolYearId) continue;
      if (s.enrollmentStatus && s.enrollmentStatus !== "active") continue;
      if (rosterStudentIds.has(s.id)) continue;
      // Only flag leavers when the roster includes external IDs we can match.
      // Without IDs we cannot safely detect withdrawals.
      if (seenExternal.size === 0) continue;
      leavingStudents.push({
        studentId: s.id,
        enrollmentId: s.enrollmentId,
        fullName: `${s.firstName} ${s.lastName}`.trim(),
        externalId: s.externalId,
        classLabel: s.classLabel ?? "—",
      });
    }
  }

  const existingCount = planned.filter(
    (r) => r.kind === "existing" || r.kind === "class_change" || r.kind === "unchanged",
  ).length;
  const newCount = planned.filter((r) => r.kind === "new").length;
  const classChangeCount = planned.filter((r) => r.kind === "class_change").length;
  const unchangedCount = planned.filter((r) => r.kind === "unchanged").length;

  const blockingErrorCount = issues.filter((i) => i.severity === "error").length;

  return {
    rows: planned,
    existingCount,
    newCount,
    classChangeCount,
    unchangedCount,
    leavingStudents,
    missingGrades: [...missingGradeSet].sort((a, b) => a.localeCompare(b)),
    missingClasses: [...missingClassMap.values()].sort((a, b) =>
      a.classLabel.localeCompare(b.classLabel),
    ),
    issues,
    blockingErrorCount,
  };
}

export function formatIssueForDisplay(issue: RosterValidationIssue): string {
  const field = issue.field ? getRosterField(issue.field).label : null;
  return field ? `Row ${issue.rowNumber} · ${field}: ${issue.message}` : `Row ${issue.rowNumber}: ${issue.message}`;
}
