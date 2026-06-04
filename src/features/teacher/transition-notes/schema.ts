export type TransitionNoteFields = {
  academicStrengths: string;
  academicNeeds: string;
  readingNotes: string;
  writingNotes: string;
  mathNotes: string;
  englishLanguageNotes: string;
  learningHabits: string;
  socialEmotionalNotes: string;
  successfulStrategies: string;
  recommendedNextSteps: string;
};

export const emptyTransitionNote = (): TransitionNoteFields => ({
  academicStrengths: "",
  academicNeeds: "",
  readingNotes: "",
  writingNotes: "",
  mathNotes: "",
  englishLanguageNotes: "",
  learningHabits: "",
  socialEmotionalNotes: "",
  successfulStrategies: "",
  recommendedNextSteps: "",
});

export type TransitionNoteSection = {
  id: string;
  title: string;
  description: string;
  fields: {
    key: keyof TransitionNoteFields;
    label: string;
    helper: string;
  }[];
};

export const transitionNoteSections: TransitionNoteSection[] = [
  {
    id: "academic",
    title: "Academic profile",
    description:
      "Capture how the learner is performing across expectations and where they need support.",
    fields: [
      {
        key: "academicStrengths",
        label: "Academic strengths",
        helper:
          "Concepts, skills, or habits where the student consistently demonstrates confidence.",
      },
      {
        key: "academicNeeds",
        label: "Academic needs",
        helper:
          "Gaps, misconceptions, pacing issues, or prerequisite skills to reinforce next.",
      },
    ],
  },
  {
    id: "subjects",
    title: "Subject-specific notes",
    description:
      "Short, practical notes the receiving teacher can act on without re-assessing everything.",
    fields: [
      {
        key: "readingNotes",
        label: "Reading notes",
        helper: "Level, strategies, fluency, comprehension patterns, and preferred scaffolds.",
      },
      {
        key: "writingNotes",
        label: "Writing notes",
        helper: "Stamina, organization, mechanics, voice, and revision habits worth continuing.",
      },
      {
        key: "mathNotes",
        label: "Math notes",
        helper: "Number sense, procedures, problem-solving approaches, and common pitfalls.",
      },
      {
        key: "englishLanguageNotes",
        label: "English language notes",
        helper: "Proficiency band, receptive/productive skills, and supports that have worked.",
      },
    ],
  },
  {
    id: "whole-child",
    title: "Whole-child context",
    description:
      "Learning habits and wellbeing signals that affect engagement and access to learning.",
    fields: [
      {
        key: "learningHabits",
        label: "Learning habits",
        helper:
          "Attention, persistence, organization, independence, group work, and self-advocacy.",
      },
      {
        key: "socialEmotionalNotes",
        label: "Social-emotional notes",
        helper:
          "Regulation, friendships, transitions, sensitivities, and strengths to leverage.",
      },
    ],
  },
  {
    id: "planning",
    title: "Strategies and next steps",
    description:
      "What has worked in your classroom and what you would prioritize in the next setting.",
    fields: [
      {
        key: "successfulStrategies",
        label: "Successful strategies",
        helper:
          "Routines, scaffolds, accommodations, and relationship moves that moved learning forward.",
      },
      {
        key: "recommendedNextSteps",
        label: "Recommended next steps",
        helper:
          "Concrete suggestions for the next teacher: goals, groupings, check-ins, or referrals.",
      },
    ],
  },
];

export function hasAnyTransitionNoteContent(data: TransitionNoteFields): boolean {
  return Object.values(data).some((value) => value.trim().length > 0);
}

export type SubmitValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateTransitionNoteForSubmit(
  data: TransitionNoteFields,
): SubmitValidationResult {
  if (!hasAnyTransitionNoteContent(data)) {
    return {
      ok: false,
      message: "Add at least one note before submitting.",
    };
  }
  return { ok: true };
}
