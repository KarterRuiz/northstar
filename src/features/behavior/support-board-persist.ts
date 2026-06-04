import { createBehaviorRecordAction } from "./actions";
import type { BehaviorLogRow } from "./load-behavior-page-data";
import {
  defaultSupportLevelForCategory,
  supportCategoryToBehaviorType,
  type BehaviorStudentOption,
  type CreateBehaviorRecordInput,
} from "./schema";
import { supportBoardActionToCategory, type SupportBoardAction } from "./support-board-chips";
import {
  generateSupportSummary,
  uiSeverityToDb,
  type SupportSummaryUiSeverity,
} from "@/lib/student-support/generate-support-summary";
import type { SupportMomentCategory } from "@/lib/student-support/quick-reasons";

function categoryToUiSeverity(category: SupportMomentCategory): SupportSummaryUiSeverity {
  if (category === "positive_recognition") return "positive";
  const d = defaultSupportLevelForCategory(category);
  if (d === "positive") return "positive";
  if (d === "low") return "low";
  if (d === "medium") return "moderate";
  return "high";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type PersistQuickSupportInput = {
  student: BehaviorStudentOption;
  classId: string;
  classLabel: string;
  action: SupportBoardAction;
  quickReasonKey: string;
  teacherNote: string;
  viewerDisplayName: string | null;
};

export type PreparedQuickSupportMoment =
  | { ok: true; insert: CreateBehaviorRecordInput; toRow: (recordId: string) => BehaviorLogRow }
  | { ok: false; message: string };

/**
 * Validates input and builds the server insert payload + row mapper (for optimistic UI).
 */
export function prepareQuickSupportMoment(input: PersistQuickSupportInput): PreparedQuickSupportMoment {
  const category = supportBoardActionToCategory[input.action];
  const uiSev = categoryToUiSeverity(category);
  const note = input.teacherNote.trim();

  const generated = generateSupportSummary({
    supportCategory: category,
    quickReasonKey: input.quickReasonKey,
    severity: uiSev,
    parentContacted: input.action === "parent" ? true : null,
    followUpRequired: false,
    timeOfDay: null,
    relatedSubject: null,
    teacherNote: note || null,
  }).trim();

  if (!generated) {
    return { ok: false, message: "Could not build summary." };
  }

  const dbSeverity = uiSeverityToDb(category, uiSev);
  const title = generated.slice(0, 200);
  const behaviorDate = todayIso();
  const behaviorType = supportCategoryToBehaviorType(category);

  const insert: CreateBehaviorRecordInput = {
    studentId: input.student.id,
    classId: input.classId,
    behaviorDate,
    supportCategory: category,
    severity: dbSeverity,
    title,
    description: note || undefined,
    quickReason: input.quickReasonKey,
    supportTags: [input.quickReasonKey],
    generatedSummary: generated,
    teacherNote: note || null,
    followUpRequired: false,
    parentContacted: input.action === "parent" ? true : null,
    timeOfDay: null,
    relatedSubject: null,
  };

  const toRow = (recordId: string): BehaviorLogRow => ({
    id: recordId,
    studentId: input.student.id,
    displayName: input.student.label,
    classId: input.classId,
    classLabel: input.classLabel,
    behaviorDate,
    behaviorType,
    supportCategory: category,
    severity: dbSeverity,
    title,
    description: note,
    generatedSummary: generated,
    teacherNote: note || null,
    supportTags: [input.quickReasonKey],
    quickReason: input.quickReasonKey,
    followUpRequired: false,
    parentContacted: input.action === "parent" ? true : null,
    timeOfDay: null,
    relatedSubject: null,
    actionTaken: null,
    createdAt: new Date().toISOString(),
    recordedByName: input.viewerDisplayName?.trim() || "You",
  });

  return { ok: true, insert, toRow };
}

export async function persistQuickSupportMoment(
  input: PersistQuickSupportInput,
): Promise<{ ok: true; row: BehaviorLogRow } | { ok: false; message: string }> {
  const prep = prepareQuickSupportMoment(input);
  if (!prep.ok) {
    return prep;
  }

  const result = await createBehaviorRecordAction(prep.insert);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  return { ok: true, row: prep.toRow(result.recordId) };
}
