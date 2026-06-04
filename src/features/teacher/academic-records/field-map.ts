import type { AcademicRecordFields } from "./schema";

type AcademicRecordRowPayload = {
  subject: string;
  term: string | null;
  score_or_grade: string | null;
  performance_level: string | null;
  teacher_comment: string | null;
  work_habits: string | null;
};

export function academicFieldsToRow(
  fields: AcademicRecordFields,
): AcademicRecordRowPayload {
  const term = fields.term.trim();
  return {
    subject: fields.subject.trim(),
    term: term || null,
    score_or_grade: fields.scoreOrGrade.trim() || null,
    performance_level: fields.performanceLevel.trim() || null,
    teacher_comment: fields.teacherComment.trim() || null,
    work_habits: fields.workHabits.trim() || null,
  };
}

export function rowToAcademicFields(row: {
  subject: string;
  term: string | null;
  score_or_grade: string | null;
  performance_level: string | null;
  teacher_comment: string | null;
  work_habits: string | null;
}): AcademicRecordFields {
  const term = row.term?.trim() ?? "";
  return {
    subject: row.subject ?? "",
    term: term === "T1" || term === "T2" || term === "T3" || term === "T4" ? term : "",
    scoreOrGrade: row.score_or_grade ?? "",
    performanceLevel: row.performance_level ?? "",
    teacherComment: row.teacher_comment ?? "",
    workHabits: row.work_habits ?? "",
  };
}
