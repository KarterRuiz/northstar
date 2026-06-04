/**
 * Deterministic, template-only support summaries (no external APIs).
 *
 * Severity UI uses low / moderate / high; DB stores `severity` as
 * positive | low | medium | high — map **moderate → medium** at persist time.
 */

import type { SupportMomentCategory } from "./quick-reasons";
import { quickReasonLabel, supportMomentCategoryLabels } from "./quick-reasons";

/** UI severity for step 3 (moderate maps to DB `medium`). */
export type SupportSummaryUiSeverity = "positive" | "low" | "moderate" | "high";

export type GenerateSupportSummaryInput = {
  supportCategory: SupportMomentCategory;
  quickReasonKey: string;
  /** Mapped UI severity (moderate allowed). */
  severity: SupportSummaryUiSeverity;
  parentContacted: boolean | null;
  followUpRequired: boolean;
  timeOfDay: string | null;
  relatedSubject: string | null;
  /** Optional teacher free text; scrubbed lightly. */
  teacherNote?: string | null;
};

/** Placeholders for educational / neutral phrases before aggressive word scrubbing. */
const NOTE_SAFE_SUBSTITUTIONS: ReadonlyArray<[RegExp, string]> = [
  [/\bno problem\b/gi, "«np»"],
  [/\bpositive attitude\b/gi, "«pa»"],
  [/\bproblem-solving\b/gi, "«ps»"],
  [/\bproblem-based\b/gi, "«pb»"],
  [/\bword problems\b/gi, "«wps»"],
  [/\bword problem\b/gi, "«wp»"],
  [/\bmath problems\b/gi, "«mps»"],
  [/\bmath problem\b/gi, "«mp»"],
  [/\bproblem solvers\b/gi, "«prs»"],
  [/\bproblem solver\b/gi, "«pr»"],
];

const NOTE_SAFE_RESTORE: ReadonlyArray<[RegExp, string]> = [
  [/«np»/gi, "no problem"],
  [/«pa»/gi, "positive attitude"],
  [/«ps»/gi, "problem-solving"],
  [/«pb»/gi, "problem-based"],
  [/«wps»/gi, "word problems"],
  [/«wp»/gi, "word problem"],
  [/«mps»/gi, "math problems"],
  [/«mp»/gi, "math problem"],
  [/«prs»/gi, "problem solvers"],
  [/«pr»/gi, "problem solver"],
];

const FORBIDDEN: ReadonlyArray<RegExp> = [
  /\bbad\b/gi,
  /\blazy\b/gi,
  /\bdisrespectful\b/gi,
  /\bdefiant\b/gi,
  /\battitude\b/gi,
  /\bproblem student\b/gi,
  /\bproblem child\b/gi,
  /\bproblem\b/gi,
  /\bproblems\b/gi,
  /\bstupid\b/gi,
  /\bworthless\b/gi,
];

/** Substrings blocked from appearing in generated output (teacher note stripped). */
export const forbiddenSupportSummaryPhrases = [
  "bad",
  "lazy",
  "disrespectful",
  "defiant",
  "attitude",
  "problem",
  "problems",
  "problem student",
  "problem child",
  "stupid",
  "worthless",
] as const;

function hashVariant(seed: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return modulo === 0 ? 0 : h % modulo;
}

function scrubNote(note: string): string {
  let t = note.trim();
  if (!t) return "";
  for (const [re, ph] of NOTE_SAFE_SUBSTITUTIONS) {
    t = t.replace(re, ph);
  }
  for (const re of FORBIDDEN) {
    t = t.replace(re, "…");
  }
  for (const [re, original] of NOTE_SAFE_RESTORE) {
    t = t.replace(re, original);
  }
  if (t.length > 400) t = `${t.slice(0, 397)}…`;
  return t;
}

/** True when scrubbed text is worth appending as teacher context. */
function isSubstantiveTeacherNote(note: string): boolean {
  const collapsed = note.replace(/[.…\s]+/g, " ").trim();
  if (collapsed.length < 8) return false;
  const letters = collapsed.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 4;
}

function learningContextClause(
  timeOfDay: string | null,
  relatedSubject: string | null,
): string | null {
  const time = timeOfDay?.trim() ?? "";
  const subject = relatedSubject?.trim() ?? "";
  if (!time && !subject) return null;
  if (time && subject) {
    return `This moment was documented during ${time} in ${subject}.`;
  }
  if (time) return `This moment was documented during ${time}.`;
  return `Related context: ${subject}.`;
}

function severityModifier(
  category: SupportMomentCategory,
  severity: SupportSummaryUiSeverity,
): string | null {
  if (category === "positive_recognition" || severity === "positive") {
    return null;
  }
  if (severity === "low") {
    return "Support remained at a universal (Tier 1) level with light prompting and monitoring.";
  }
  if (severity === "moderate") {
    return "Additional Tier 1–2 structures such as predictable routines and brief check-ins may strengthen consistency.";
  }
  return "Priority adult coordination helps keep responses predictable, restorative, and aligned with the student’s plan.";
}

function concernSeverityTail(severity: SupportSummaryUiSeverity): string | null {
  if (severity === "positive") return null;
  if (severity === "low") {
    return "Support remained at a universal (Tier 1) level; informal monitoring and encouragement can maintain momentum.";
  }
  if (severity === "moderate") {
    return "Tier 1–2 structures such as task chunking and brief check-ins may further stabilize engagement.";
  }
  return "Coordinated Tier 2–3 responses among adults will help keep supports predictable and restorative in upcoming blocks.";
}

type ReasonMap = Record<string, string>;

const POSITIVE_REASON_CLAUSE: ReasonMap = {
  leadership: "Leadership actions contributed positively to the learning community.",
  collaboration: "The student engaged collaboratively with peers in ways that advanced shared work.",
  academic_growth: "Academic growth was evident and worth reinforcing with specific feedback.",
  kindness: "Kindness toward peers or adults supported a respectful classroom climate.",
  persistence: "Persistence on a demanding task reflected productive academic habits.",
  participation: "Participation and collaborative engagement strengthened class dialogue and shared understanding.",
  responsibility: "Responsibility for materials or routines supported smooth classroom operations.",
};

const CONCERN_REASON_CLAUSE: ReasonMap = {
  off_task:
    "The student benefited from additional support to sustain attention during independent work; redirection, task chunking, and brief check-ins helped recenter the task.",
  incomplete_work:
    "Completion was supported by clarifying expectations, chunking the assignment into manageable steps, and using short check-ins to celebrate incremental progress.",
  peer_conflict:
    "A peer interaction was paused and guided with clear expectations and restorative language.",
  emotional_regulation:
    "Co-regulation strategies and a brief reset supported the student before rejoining the learning task.",
  transition_difficulty:
    "Transitions were scaffolded with previews and signals to reduce friction between activities.",
  difficulty_transitioning:
    "Transitions were scaffolded with previews and signals to reduce friction between activities.",
  technology_misuse:
    "Technology use was redirected toward the learning goal with a calm reset of expectations.",
  disruptive_instruction:
    "During instruction, proximity and reframing helped restore a calm, focused learning environment.",
  unprepared:
    "Readiness was supported by supplying materials or a short entry plan so the student could engage.",
};

const PARENT_COMMS_REASON_CLAUSE: ReasonMap = {
  positive_update: "A strengths-based update was shared with the home team.",
  academic_concern: "Academic patterns were reviewed with caregivers using neutral, solution-focused language.",
  behavioral_concern: "Observed patterns were shared with caregivers alongside supportive school-based steps already in use.",
  follow_up_discussion: "A follow-up discussion was scheduled or continued to align on next steps.",
  academic_check_in: "An academic check-in clarified expectations and supports across settings.",
  attendance_concern: "Attendance was discussed with a focus on barriers and coordinated supports.",
  social_emotional_update: "Social-emotional information was shared to support continuity of care.",
  scheduling_logistics: "Scheduling or logistics were coordinated to reduce friction for the learner.",
  requested_callback: "A callback or return contact was requested to continue the conversation.",
  shared_resources: "Resources or strategies were shared to reinforce learning at home and school.",
  celebration: "Growth and effort were celebrated with the home team.",
};

const SEL_REASON_CLAUSE: ReasonMap = {
  self_regulation: "Self-regulation strategies were observed or supported in context.",
  peer_interaction: "Peer interaction reflected skills the team can continue to nurture.",
  coping_strategy: "A coping strategy was noted as part of the student’s emerging toolkit.",
  calm_recovery: "The student recovered calmly after stress and returned to learning.",
  self_advocacy: "Self-advocacy was observed or encouraged as part of student agency.",
  empathy: "Empathy toward others contributed to a prosocial classroom climate.",
  mindfulness_focus: "Focus or mindfulness practices supported engagement.",
  sensory_needs: "Sensory considerations were noted to inform environmental supports.",
};

const STRATEGY_REASON_CLAUSE: ReasonMap = {
  visual_reminders: "Visual reminders were used to orient the student toward the task sequence.",
  seating_adjustment: "A seating adjustment supported focus and access to instruction.",
  task_chunking: "Task chunking was applied to make workload feel attainable and measurable.",
  peer_support: "Peer support was structured to promote collaboration without over-reliance.",
  check_in_out: "A check-in/check-out routine reinforced goals and closure across the period.",
  positive_reinforcement: "Positive reinforcement highlighted effort tied to clear criteria.",
  movement_break: "A movement break was used to regulate energy before returning to work.",
  teacher_conference: "A brief teacher conference clarified expectations and next steps.",
};

const INTERVENTION_REASON_CLAUSE: ReasonMap = {
  tier1_checkin: "A Tier 1 check-in confirmed universal supports are visible and consistent.",
  small_group: "Small-group instruction or practice was leveraged to close a specific skill gap.",
  specialist_meeting: "Specialist input was incorporated to align services with classroom routines.",
  plan_adjustment: "The support plan was reviewed and adjusted based on recent observations.",
  home_school_coordination: "Home and school coordinated routines or signals to reinforce the same goals.",
  data_review: "Data were reviewed to decide whether current supports are producing expected growth.",
  goal_progress: "Progress toward an agreed goal was documented for the intervention team.",
  next_step_scheduled: "A concrete next step was scheduled to maintain momentum.",
};

function categoryReasonClause(
  category: SupportMomentCategory,
  reasonKey: string,
  reasonLabel: string,
): string {
  const key = reasonKey.trim() || reasonLabel;
  const maps: Record<SupportMomentCategory, ReasonMap> = {
    positive_recognition: POSITIVE_REASON_CLAUSE,
    quick_concern: CONCERN_REASON_CLAUSE,
    parent_communication: PARENT_COMMS_REASON_CLAUSE,
    sel_observation: SEL_REASON_CLAUSE,
    support_strategy: STRATEGY_REASON_CLAUSE,
    intervention_followup: INTERVENTION_REASON_CLAUSE,
  };
  const map = maps[category];
  if (map[key]) return map[key];
  const label = reasonLabel.toLowerCase();
  const fallbacks: Record<SupportMomentCategory, string> = {
    positive_recognition: `Strengths connected to ${label} were uplifted for the learning community.`,
    quick_concern: `A learning moment tied to ${label} was addressed with supportive, non-punitive routines.`,
    parent_communication: `Communication with caregivers centered on ${label}.`,
    sel_observation: `An observation related to ${label} was recorded to inform tiered supports.`,
    support_strategy: `A classroom strategy linked to ${label} was implemented to support engagement and completion.`,
    intervention_followup: `Intervention documentation addressed ${label} within the existing plan.`,
  };
  return fallbacks[category];
}

function strategyLead(seed: string, clause: string): string {
  const v = hashVariant(seed, 2);
  return v === 0
    ? `The teacher implemented a support move aligned with MTSS: ${clause.charAt(0).toLowerCase()}${clause.slice(1)}`
    : `Classroom practice included a structured support: ${clause.charAt(0).toLowerCase()}${clause.slice(1)}`;
}

function selLead(seed: string, clause: string): string {
  const v = hashVariant(seed, 2);
  return v === 0
    ? `SEL documentation: ${clause.charAt(0).toLowerCase()}${clause.slice(1)}`
    : `Social-emotional snapshot: ${clause.charAt(0).toLowerCase()}${clause.slice(1)}`;
}

function interventionLead(seed: string, clause: string): string {
  const v = hashVariant(seed, 2);
  return v === 0
    ? `Intervention follow-up: ${clause.charAt(0).toLowerCase()}${clause.slice(1)}`
    : `Plan-aligned note: ${clause.charAt(0).toLowerCase()}${clause.slice(1)}`;
}

function parentContactClause(): string {
  return "The home–school team was connected to align next steps and continuity of school–home support without assigning blame.";
}

function followUpClause(): string {
  return "A brief follow-up is recommended to confirm the agreed supports are working for the learner.";
}

/** Composes context, parent contact, and follow-up into at most one sentence (block 3). */
function continuityBlock(
  timeOfDay: string | null,
  relatedSubject: string | null,
  parentContacted: boolean | null,
  followUpRequired: boolean,
  skipParentPhrase: boolean,
): string | null {
  const ctx = learningContextClause(timeOfDay, relatedSubject);
  const wantParent = !skipParentPhrase && parentContacted === true;
  const wantFollow = followUpRequired;

  if (!ctx && !wantParent && !wantFollow) return null;

  const parts: string[] = [];
  if (ctx) parts.push(ctx.replace(/\.\s*$/, ""));
  if (wantParent) parts.push(parentContactClause().replace(/\.\s*$/, ""));
  if (wantFollow) parts.push(followUpClause().replace(/\.\s*$/, ""));
  return `${parts.join(" ")}.`;
}

function primaryBlock(
  input: GenerateSupportSummaryInput,
  reasonLabel: string,
  reasonClause: string,
  seed: string,
): string {
  const { supportCategory } = input;
  const headline = `${supportMomentCategoryLabels[supportCategory]} — ${reasonLabel}`;

  if (supportCategory === "positive_recognition") {
    const v = hashVariant(seed, 3);
    const lead = v === 0 ? "Recognized" : v === 1 ? "Documented" : "Highlighted";
    const body = reasonClause.charAt(0).toLowerCase() + reasonClause.slice(1);
    return `${headline}: ${lead} ${body}`;
  }
  if (supportCategory === "support_strategy") {
    return `${headline}: ${strategyLead(seed, reasonClause)}`;
  }
  if (supportCategory === "sel_observation") {
    return `${headline}: ${selLead(seed, reasonClause)}`;
  }
  if (supportCategory === "intervention_followup") {
    return `${headline}: ${interventionLead(seed, reasonClause)}`;
  }
  if (supportCategory === "parent_communication") {
    const v = hashVariant(seed, 2);
    const prefix =
      v === 0 ? "Parent or caregiver communication" : "Family partnership documentation";
    return `${headline}: ${prefix} — ${reasonClause}`;
  }
  if (supportCategory === "quick_concern") {
    const v = hashVariant(seed, 2);
    const prefix =
      v === 0 ? "Instructional support framing" : "Learning environment support framing";
    return `${headline}: ${prefix} — ${reasonClause}`;
  }
  return `${headline}: ${reasonClause}`;
}

function supportLevelBlock(
  supportCategory: SupportMomentCategory,
  severity: SupportSummaryUiSeverity,
): string | null {
  if (supportCategory === "quick_concern") {
    return concernSeverityTail(severity);
  }
  return severityModifier(supportCategory, severity);
}

/**
 * Assembles 2–4 concise sentences: primary (category + quick reason + narrative),
 * optional tier/severity, optional continuity (context / parent / follow-up), optional teacher note.
 */
function assembleSummary(input: GenerateSupportSummaryInput): string {
  const { supportCategory, quickReasonKey, severity, parentContacted, followUpRequired } = input;
  const reasonLabel = quickReasonLabel(supportCategory, quickReasonKey);
  const seed = `${supportCategory}:${quickReasonKey}`;
  const reasonClause = categoryReasonClause(supportCategory, quickReasonKey, reasonLabel);

  const sentences: string[] = [];
  sentences.push(primaryBlock(input, reasonLabel, reasonClause, seed));

  const level = supportLevelBlock(supportCategory, severity);
  if (level) sentences.push(level);

  const skipParentPhrase = supportCategory === "parent_communication" || parentContacted !== true;
  const continuity = continuityBlock(
    input.timeOfDay,
    input.relatedSubject,
    parentContacted,
    followUpRequired,
    skipParentPhrase,
  );
  if (continuity) sentences.push(continuity);

  const note = scrubNote(input.teacherNote ?? "");
  if (isSubstantiveTeacherNote(note)) {
    sentences.push(`Teacher noted: ${note}`);
  }

  return sentences.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Builds a short, parent-safe summary string from structured selections.
 */
export function generateSupportSummary(input: GenerateSupportSummaryInput): string {
  return assembleSummary(input);
}

/** Map guided UI severity to `behavior_records.severity`. */
export function uiSeverityToDb(
  category: SupportMomentCategory,
  ui: SupportSummaryUiSeverity,
): "positive" | "low" | "medium" | "high" {
  if (category === "positive_recognition") return "positive";
  if (ui === "positive") return "positive";
  if (ui === "low") return "low";
  if (ui === "moderate") return "medium";
  return "high";
}
