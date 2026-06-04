import { REPORT_CARD_TERMS, type ReportCardTerm } from "@/lib/report-cards/constants";

export type AcademicRecordFields = {
  subject: string;
  term: ReportCardTerm | "";
  scoreOrGrade: string;
  performanceLevel: string;
  teacherComment: string;
  workHabits: string;
};

export function emptyAcademicRecord(): AcademicRecordFields {
  return {
    subject: "",
    term: "",
    scoreOrGrade: "",
    performanceLevel: "",
    teacherComment: "",
    workHabits: "",
  };
}

function termValidationError(term: string): string | null {
  if (term && !(REPORT_CARD_TERMS as readonly string[]).includes(term)) {
    return "Term must be T1, T2, T3, or T4.";
  }
  return null;
}

/** Draft saves allow empty subject; term must still be valid when set. */
export function validateAcademicRecordForDraft(
  fields: AcademicRecordFields,
): string | null {
  return termValidationError(fields.term);
}

export function validateAcademicRecordForSubmit(
  fields: AcademicRecordFields,
): string | null {
  if (!fields.subject.trim()) {
    return "Subject is required.";
  }
  return termValidationError(fields.term);
}
