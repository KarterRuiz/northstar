"use client";

import * as React from "react";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  MessageCircleWarning,
  MessagesSquare,
  Puzzle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { selectClassName } from "@/features/teacher/gradebook/gradebook-utils";
import {
  generateSupportSummary,
  uiSeverityToDb,
  type SupportSummaryUiSeverity,
} from "@/lib/student-support/generate-support-summary";
import {
  quickReasonsByCategory,
  supportMomentCategories,
  supportMomentCategoryLabels,
  type SupportMomentCategory,
} from "@/lib/student-support/quick-reasons";
import { cn } from "@/lib/utils";

import { createBehaviorRecordAction } from "./actions";
import type { BehaviorLogRow } from "./load-behavior-page-data";
import {
  defaultSupportLevelForCategory,
  supportCategoryToBehaviorType,
  type BehaviorStudentOption,
} from "./schema";

type BehaviorEntrySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: BehaviorStudentOption[];
  classes: { id: string; label: string }[];
  pageClassId: string | null;
  viewerDisplayName: string | null;
  onSaved: (row: BehaviorLogRow) => void;
  onError: (message: string) => void;
};

const TIME_OF_DAY = ["Morning", "Midday", "Afternoon", "After school"] as const;

const CATEGORY_ICONS: Record<SupportMomentCategory, React.ElementType> = {
  positive_recognition: Sparkles,
  quick_concern: MessageCircleWarning,
  parent_communication: MessagesSquare,
  sel_observation: Brain,
  support_strategy: Puzzle,
  intervention_followup: RefreshCw,
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveClassId(
  student: BehaviorStudentOption | undefined,
  pageClassId: string | null,
  formClassId: string,
): string | null {
  if (!student) return null;
  if (pageClassId && student.classIds.includes(pageClassId)) return pageClassId;
  if (formClassId && student.classIds.includes(formClassId)) return formClassId;
  if (student.classIds.length === 1) return student.classIds[0] ?? null;
  return formClassId || null;
}

function uiDefaultSeverity(cat: SupportMomentCategory): SupportSummaryUiSeverity {
  if (cat === "positive_recognition") return "positive";
  const d = defaultSupportLevelForCategory(cat);
  if (d === "positive") return "positive";
  if (d === "low") return "low";
  if (d === "medium") return "moderate";
  return "high";
}

export function BehaviorEntrySheet({
  open,
  onOpenChange,
  students,
  classes,
  pageClassId,
  viewerDisplayName,
  onSaved,
  onError,
}: BehaviorEntrySheetProps) {
  const [pending, setPending] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);

  const defaultCat: SupportMomentCategory = "positive_recognition";

  function emptyForm() {
    const first = students[0];
    const cat = defaultCat;
    return {
      studentId: first?.id ?? "",
      classId: pageClassId ?? first?.classIds[0] ?? "",
      behaviorDate: todayIso(),
      supportCategory: cat,
      quickReasonKey: "",
      uiSeverity: uiDefaultSeverity(cat) as SupportSummaryUiSeverity,
      parentContacted: null as boolean | null,
      followUpRequired: false,
      teacherNote: "",
      timeOfDay: "" as string,
      relatedSubject: "",
    };
  }

  const [form, setForm] = React.useState(emptyForm);

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(emptyForm());
      setStep(1);
    }
    onOpenChange(next);
  }

  const selectedStudent = students.find((s) => s.id === form.studentId);
  const resolvedClassId = resolveClassId(selectedStudent, pageClassId, form.classId);
  const needsClassPick = Boolean(
    selectedStudent && selectedStudent.classIds.length > 1 && !pageClassId,
  );
  const classOptions = needsClassPick
    ? classes.filter((c) => selectedStudent?.classIds.includes(c.id))
    : [];

  function selectCategory(cat: SupportMomentCategory) {
    setForm((f) => ({
      ...f,
      supportCategory: cat,
      quickReasonKey: "",
      uiSeverity: uiDefaultSeverity(cat),
    }));
  }

  const summaryPreview = React.useMemo(() => {
    if (!form.quickReasonKey.trim()) return "";
    return generateSupportSummary({
      supportCategory: form.supportCategory,
      quickReasonKey: form.quickReasonKey.trim(),
      severity: form.uiSeverity,
      parentContacted: form.parentContacted,
      followUpRequired: form.followUpRequired,
      timeOfDay: form.timeOfDay.trim() || null,
      relatedSubject: form.relatedSubject.trim() || null,
      teacherNote: form.teacherNote,
    });
  }, [form]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const classId = resolvedClassId;
    if (!classId) {
      onError("Choose which class this moment belongs to.");
      return;
    }
    if (!form.quickReasonKey.trim()) {
      onError("Pick a quick reason on step 2.");
      return;
    }

    const generated = summaryPreview.trim();
    if (!generated) {
      onError("Could not build summary.");
      return;
    }

    const dbSeverity = uiSeverityToDb(form.supportCategory, form.uiSeverity);
    const title = generated.slice(0, 200);

    setPending(true);
    const result = await createBehaviorRecordAction({
      studentId: form.studentId,
      classId,
      behaviorDate: form.behaviorDate,
      supportCategory: form.supportCategory,
      severity: dbSeverity,
      title,
      description: form.teacherNote.trim() || undefined,
      quickReason: form.quickReasonKey.trim(),
      supportTags: [form.quickReasonKey.trim()],
      generatedSummary: generated,
      teacherNote: form.teacherNote.trim() || null,
      followUpRequired: form.followUpRequired,
      parentContacted: form.parentContacted,
      timeOfDay: form.timeOfDay.trim() || null,
      relatedSubject: form.relatedSubject.trim() || null,
    });
    setPending(false);

    if (!result.ok) {
      onError(result.message);
      return;
    }

    const behaviorType = supportCategoryToBehaviorType(form.supportCategory);
    const classLabel = classes.find((c) => c.id === classId)?.label ?? "—";

    const optimistic: BehaviorLogRow = {
      id: result.recordId,
      studentId: form.studentId,
      displayName: selectedStudent?.label ?? "Student",
      classId,
      classLabel,
      behaviorDate: form.behaviorDate,
      behaviorType,
      supportCategory: form.supportCategory,
      severity: dbSeverity,
      title,
      description: form.teacherNote.trim(),
      generatedSummary: generated,
      teacherNote: form.teacherNote.trim() || null,
      supportTags: [form.quickReasonKey.trim()],
      quickReason: form.quickReasonKey.trim(),
      followUpRequired: form.followUpRequired,
      parentContacted: form.parentContacted,
      timeOfDay: form.timeOfDay.trim() || null,
      relatedSubject: form.relatedSubject.trim() || null,
      actionTaken: null,
      createdAt: new Date().toISOString(),
      recordedByName: viewerDisplayName?.trim() || "You",
    };

    onSaved(optimistic);
    handleOpenChange(false);
  }

  const showNonPositiveSeverity = form.supportCategory !== "positive_recognition";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <SheetHeader className="border-border/60 shrink-0 border-b px-6 pb-4 pt-6">
            <SheetTitle>New support moment</SheetTitle>
            <SheetDescription>
              Three quick steps — strengths, check-ins, and strategies stay visible for the team.
            </SheetDescription>
            <ol className="text-muted-foreground mt-3 flex gap-2 text-xs">
              {[1, 2, 3].map((n) => (
                <li
                  key={n}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 font-medium",
                    step === n ? "bg-primary text-primary-foreground" : "bg-muted/50",
                  )}
                >
                  {n}. {n === 1 ? "Type" : n === 2 ? "Reason" : "Details"}
                </li>
              ))}
            </ol>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4 border-border/50 border-b pb-5">
              <div className="space-y-1.5">
                <Label>Student</Label>
                <select
                  className={selectClassName}
                  value={form.studentId}
                  onChange={(e) => {
                    const student = students.find((s) => s.id === e.target.value);
                    setForm((f) => ({
                      ...f,
                      studentId: e.target.value,
                      classId: student?.classIds[0] ?? f.classId,
                    }));
                  }}
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {needsClassPick ? (
                <div className="space-y-1.5">
                  <Label>Class</Label>
                  <select
                    className={selectClassName}
                    value={form.classId}
                    onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                  >
                    <option value="" disabled>
                      Select class
                    </option>
                    {classOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="support-date">Date</Label>
                <Input
                  id="support-date"
                  type="date"
                  required
                  value={form.behaviorDate}
                  onChange={(e) => setForm((f) => ({ ...f, behaviorDate: e.target.value }))}
                />
              </div>
            </div>

            {step === 1 ? (
              <div className="mt-6 space-y-3">
                <Label className="text-foreground">What kind of moment?</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {supportMomentCategories.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat];
                    const active = form.supportCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => selectCategory(cat)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/5 ring-primary/20 ring-1"
                            : "border-border/70 bg-card hover:bg-muted/40",
                        )}
                      >
                        <span className="bg-muted/60 text-muted-foreground mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="leading-snug font-medium">
                          {supportMomentCategoryLabels[cat]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mt-6 space-y-3">
                <Label className="text-foreground">Quick reason</Label>
                <p className="text-muted-foreground text-xs">
                  {supportMomentCategoryLabels[form.supportCategory]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickReasonsByCategory[form.supportCategory].map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, quickReasonKey: r.key }))}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        form.quickReasonKey === r.key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/80 bg-muted/30 text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="mt-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-foreground">Optional details</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setStep(2)}
                  >
                    <ChevronLeft className="mr-1 size-3" aria-hidden />
                    Reason
                  </Button>
                </div>

                {showNonPositiveSeverity ? (
                  <div className="space-y-1.5">
                    <Label>Support level</Label>
                    <p className="text-muted-foreground text-xs">
                      In the database this maps to{" "}
                      <span className="text-foreground/90 font-medium">low / medium / high</span>
                      ; “Moderate” here is stored as medium.
                    </p>
                    <select
                      className={selectClassName}
                      value={form.uiSeverity === "positive" ? "low" : form.uiSeverity}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          uiSeverity: e.target.value as SupportSummaryUiSeverity,
                        }))
                      }
                    >
                      <option value="low">Light touch</option>
                      <option value="moderate">Follow-up soon</option>
                      <option value="high">Priority support</option>
                    </select>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label>Parent contacted</Label>
                  <select
                    className={selectClassName}
                    value={
                      form.parentContacted === null
                        ? "unspecified"
                        : form.parentContacted
                          ? "yes"
                          : "no"
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({
                        ...f,
                        parentContacted: v === "unspecified" ? null : v === "yes",
                      }));
                    }}
                  >
                    <option value="unspecified">Not specified</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="follow-up"
                    type="checkbox"
                    checked={form.followUpRequired}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, followUpRequired: e.target.checked }))
                    }
                    className="size-4 rounded border"
                  />
                  <Label htmlFor="follow-up" className="font-normal">
                    Follow-up needed
                  </Label>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="time-of-day">Time of day</Label>
                  <select
                    id="time-of-day"
                    className={selectClassName}
                    value={form.timeOfDay}
                    onChange={(e) => setForm((f) => ({ ...f, timeOfDay: e.target.value }))}
                  >
                    <option value="">Not specified</option>
                    {TIME_OF_DAY.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="related-subject">Related subject / class context</Label>
                  <Input
                    id="related-subject"
                    value={form.relatedSubject}
                    onChange={(e) => setForm((f) => ({ ...f, relatedSubject: e.target.value }))}
                    placeholder="e.g. Mathematics, advisory"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="teacher-note">
                    Teacher note <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    id="teacher-note"
                    value={form.teacherNote}
                    onChange={(e) => setForm((f) => ({ ...f, teacherNote: e.target.value }))}
                    rows={2}
                    placeholder="Anything helpful for you or a colleague later"
                  />
                </div>

                <div className="bg-muted/30 border-border/60 rounded-xl border p-3">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Support summary
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed">
                    {summaryPreview || "Choose a quick reason to preview the summary."}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <SheetFooter className="border-border/60 mt-auto flex flex-col gap-2 border-t bg-background/95 px-6 py-4 sm:flex-row sm:justify-end">
            {step === 1 ? (
              <Button type="button" className="w-full sm:w-auto" onClick={() => setStep(2)}>
                Next: Quick reason
                <ChevronRight className="ml-1 size-4" aria-hidden />
              </Button>
            ) : null}
            {step === 2 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:mr-auto sm:w-auto"
                  onClick={() => setStep(1)}
                >
                  <ChevronLeft className="mr-1 size-4" aria-hidden />
                  Back
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={!form.quickReasonKey}
                  onClick={() => setStep(3)}
                >
                  Next: Details
                  <ChevronRight className="ml-1 size-4" aria-hidden />
                </Button>
              </>
            ) : null}
            {step === 3 ? (
              <Button type="submit" disabled={pending || students.length === 0 || !summaryPreview}>
                {pending ? "Saving…" : "Save support moment"}
              </Button>
            ) : null}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
