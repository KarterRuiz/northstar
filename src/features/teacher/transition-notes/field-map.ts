import type { TransitionNoteFields } from "./schema";

export type TransitionNoteRowFields = {
  academic_strengths: string;
  academic_needs: string;
  reading_notes: string;
  writing_notes: string;
  math_notes: string;
  english_language_notes: string;
  learning_habits: string;
  social_emotional_notes: string;
  successful_strategies: string;
  recommended_next_steps: string;
};

export function transitionFieldsToRow(
  fields: TransitionNoteFields,
): TransitionNoteRowFields {
  return {
    academic_strengths: fields.academicStrengths,
    academic_needs: fields.academicNeeds,
    reading_notes: fields.readingNotes,
    writing_notes: fields.writingNotes,
    math_notes: fields.mathNotes,
    english_language_notes: fields.englishLanguageNotes,
    learning_habits: fields.learningHabits,
    social_emotional_notes: fields.socialEmotionalNotes,
    successful_strategies: fields.successfulStrategies,
    recommended_next_steps: fields.recommendedNextSteps,
  };
}

export function rowToTransitionFields(row: TransitionNoteRowFields): TransitionNoteFields {
  return {
    academicStrengths: row.academic_strengths,
    academicNeeds: row.academic_needs,
    readingNotes: row.reading_notes,
    writingNotes: row.writing_notes,
    mathNotes: row.math_notes,
    englishLanguageNotes: row.english_language_notes,
    learningHabits: row.learning_habits,
    socialEmotionalNotes: row.social_emotional_notes,
    successfulStrategies: row.successful_strategies,
    recommendedNextSteps: row.recommended_next_steps,
  };
}
