"use client";

import * as React from "react";

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

import { createInterventionAction } from "./actions";
import { FollowUpDateField } from "./follow-up-date-field";
import { suggestFollowUpDate } from "./suggest-follow-up-date";
import {
  interventionQuickPresets,
  interventionSeverities,
  interventionStatuses,
  interventionTypes,
  interventionSeverityLabels,
  interventionStatusLabels,
  interventionTypeLabels,
  type CreateInterventionInput,
  type InterventionPreset,
  type InterventionSeverity,
  type InterventionStatus,
  type InterventionType,
} from "./schema";

type FormState = Omit<CreateInterventionInput, "studentId" | "classId">;

type CreateInterventionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  classId: string;
  studentName: string;
  initialForm?: Partial<FormState>;
  onCreated?: (
    interventionId: string,
    input: Omit<CreateInterventionInput, "studentId" | "classId">,
  ) => void;
};

function emptyForm(): FormState {
  const severity: InterventionSeverity = "medium";
  const interventionType: InterventionType = "academic_support";
  return {
    interventionType,
    severity,
    title: "",
    description: "",
    status: "active",
    followUpDate: suggestFollowUpDate({ severity, interventionType }),
  };
}

function formFromInitial(initial?: Partial<FormState>): FormState {
  const base = emptyForm();
  if (!initial) return base;
  return {
    ...base,
    ...initial,
    followUpDate:
      initial.followUpDate !== undefined
        ? initial.followUpDate
        : suggestFollowUpDate({
            severity: initial.severity ?? base.severity,
            interventionType: initial.interventionType ?? base.interventionType,
          }),
  };
}

export function CreateInterventionSheet({
  open,
  onOpenChange,
  studentId,
  classId,
  studentName,
  initialForm,
  onCreated,
}: CreateInterventionSheetProps) {
  const [form, setForm] = React.useState<FormState>(() => formFromInitial(initialForm));
  const [isFollowUpCustomized, setIsFollowUpCustomized] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const suggestedFollowUpDate = React.useMemo(
    () =>
      suggestFollowUpDate({
        severity: form.severity,
        interventionType: form.interventionType,
      }),
    [form.severity, form.interventionType],
  );

  function applyFormPatch(patch: Partial<FormState>) {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (isFollowUpCustomized) return next;
      return {
        ...next,
        followUpDate: suggestFollowUpDate({
          severity: next.severity,
          interventionType: next.interventionType,
        }),
      };
    });
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(formFromInitial(initialForm));
      setIsFollowUpCustomized(false);
      setMessage(null);
    } else {
      setForm(emptyForm());
      setIsFollowUpCustomized(false);
      setMessage(null);
    }
    onOpenChange(next);
  }

  function applyPreset(preset: InterventionPreset) {
    const followUpDate = suggestFollowUpDate({
      severity: preset.severity,
      interventionType: preset.interventionType,
    });
    setIsFollowUpCustomized(false);
    setForm({
      interventionType: preset.interventionType,
      severity: preset.severity,
      title: preset.title,
      description: preset.description,
      status: "active",
      followUpDate,
    });
  }

  function submit() {
    setMessage(null);
    const followUpDate = isFollowUpCustomized
      ? form.followUpDate
      : suggestedFollowUpDate;
    startTransition(async () => {
      const result = await createInterventionAction({
        studentId,
        classId,
        ...form,
        followUpDate,
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      onCreated?.(result.interventionId, {
        interventionType: form.interventionType,
        severity: form.severity,
        title: form.title,
        description: form.description,
        status: form.status,
        followUpDate,
      });
      handleOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="shrink-0 border-b pb-4">
          <SheetTitle>Add intervention</SheetTitle>
          <SheetDescription>
            Support plan for <span className="text-foreground font-medium">{studentName}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-1 py-4">
          <div className="space-y-2">
            <p className="text-xs font-medium">Quick presets</p>
            <div className="flex flex-wrap gap-2">
              {interventionQuickPresets.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={pending}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="iv-type" className="text-xs">
                Type
              </Label>
              <select
                id="iv-type"
                className={selectClassName}
                value={form.interventionType}
                disabled={pending}
                onChange={(e) =>
                  applyFormPatch({
                    interventionType: e.target.value as InterventionType,
                  })
                }
              >
                {interventionTypes.map((t) => (
                  <option key={t} value={t}>
                    {interventionTypeLabels[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iv-severity" className="text-xs">
                Severity
              </Label>
              <select
                id="iv-severity"
                className={selectClassName}
                value={form.severity}
                disabled={pending}
                onChange={(e) =>
                  applyFormPatch({
                    severity: e.target.value as InterventionSeverity,
                  })
                }
              >
                {interventionSeverities.map((s) => (
                  <option key={s} value={s}>
                    {interventionSeverityLabels[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iv-status" className="text-xs">
                Status
              </Label>
              <select
                id="iv-status"
                className={selectClassName}
                value={form.status}
                disabled={pending}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as InterventionStatus,
                  }))
                }
              >
                {interventionStatuses.map((s) => (
                  <option key={s} value={s}>
                    {interventionStatusLabels[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="iv-title" className="text-xs">
              Title
            </Label>
            <Input
              id="iv-title"
              value={form.title}
              disabled={pending}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="iv-desc" className="text-xs">
              Description
            </Label>
            <Textarea
              id="iv-desc"
              rows={4}
              value={form.description}
              disabled={pending}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <FollowUpDateField
            value={form.followUpDate}
            suggestedDate={suggestedFollowUpDate}
            disabled={pending}
            onCustomize={() => setIsFollowUpCustomized(true)}
            onChange={(followUpDate) =>
              setForm((f) => ({ ...f, followUpDate }))
            }
          />

          {message ? (
            <p className="text-destructive text-sm" role="alert">
              {message}
            </p>
          ) : null}
        </div>

        <SheetFooter className="shrink-0 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending || !form.title.trim()} onClick={submit}>
            {pending ? "Saving…" : "Create intervention"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
