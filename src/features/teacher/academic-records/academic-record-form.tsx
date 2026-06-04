"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_CARD_TERMS } from "@/lib/report-cards/constants";
import { cn } from "@/lib/utils";

import { saveAcademicRecordDraft, submitAcademicRecord } from "./actions";
import {
  validateAcademicRecordForSubmit,
  type AcademicRecordFields,
} from "./schema";

type Status =
  | { kind: "idle" }
  | { kind: "draft-saved"; at: number }
  | { kind: "submitted" }
  | { kind: "error"; message: string };

function formatSavedAt(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "just now";
  }
}

const selectClassName = cn(
  "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export type AcademicRecordFormProps = {
  studentId: string;
  classId: string;
  initialRecordId?: string;
  initialValues: AcademicRecordFields;
  editable: boolean;
  lockedStatus?: string;
  backHref: string;
};

export function AcademicRecordForm({
  studentId,
  classId,
  initialRecordId,
  initialValues,
  editable,
  lockedStatus,
  backHref,
}: AcademicRecordFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState<AcademicRecordFields>(initialValues);
  const [recordId, setRecordId] = React.useState<string | undefined>(initialRecordId);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleChange = (key: keyof AcademicRecordFields, next: string) => {
    setValues((prev) => ({ ...prev, [key]: next }));
    if (status.kind === "error" || status.kind === "draft-saved") {
      setStatus({ kind: "idle" });
    }
  };

  const handleSaveDraft = async () => {
    if (!editable) return;
    setIsSaving(true);
    setStatus({ kind: "idle" });
    const result = await saveAcademicRecordDraft({
      studentId,
      classId,
      recordId,
      data: values,
    });
    setIsSaving(false);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.message });
      return;
    }
    setRecordId(result.recordId);
    setStatus({ kind: "draft-saved", at: Date.now() });
    router.refresh();
  };

  const handleSubmit = async () => {
    if (!editable) return;
    const validation = validateAcademicRecordForSubmit(values);
    if (validation) {
      setStatus({ kind: "error", message: validation });
      return;
    }
    setIsSubmitting(true);
    setStatus({ kind: "idle" });
    const result = await submitAcademicRecord({
      studentId,
      classId,
      recordId,
      data: values,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.message });
      return;
    }
    setRecordId(result.recordId);
    setStatus({ kind: "submitted" });
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Academic record</CardTitle>
          {!editable && lockedStatus ? (
            <Badge variant="secondary" className="capitalize">
              {lockedStatus.replace("_", " ")}
            </Badge>
          ) : (
            <Badge variant="outline">Draft</Badge>
          )}
        </div>
        <CardDescription>
          Structured entry for report-card data later. PDF uploads stay on the report
          cards tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SubjectField
          value={values.subject}
          editable={editable}
          onChange={(v) => handleChange("subject", v)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TermField
            value={values.term}
            editable={editable}
            onChange={(v) => handleChange("term", v)}
          />
          <ScoreField
            value={values.scoreOrGrade}
            editable={editable}
            onChange={(v) => handleChange("scoreOrGrade", v)}
          />
          <PerformanceField
            value={values.performanceLevel}
            editable={editable}
            onChange={(v) => handleChange("performanceLevel", v)}
          />
        </div>
        <CommentField
          value={values.teacherComment}
          editable={editable}
          onChange={(v) => handleChange("teacherComment", v)}
        />
        <HabitsField
          value={values.workHabits}
          editable={editable}
          onChange={(v) => handleChange("workHabits", v)}
        />
        {status.kind === "error" ? (
          <p className="text-destructive text-sm" role="alert">
            {status.message}
          </p>
        ) : null}
        {status.kind === "draft-saved" ? (
          <p className="text-muted-foreground text-sm" role="status">
            Draft saved at {formatSavedAt(status.at)}.
          </p>
        ) : null}
        {status.kind === "submitted" ? (
          <p className="text-muted-foreground text-sm" role="status">
            Submitted for review. Leadership can mark it reviewed from academic review.
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t pt-6">
        <Button type="button" variant="outline" asChild>
          <a href={backHref}>Back</a>
        </Button>
        {editable ? (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving || isSubmitting}
              onClick={() => void handleSaveDraft()}
            >
              {isSaving ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="button"
              disabled={isSaving || isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? "Submitting…" : "Submit for review"}
            </Button>
          </>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function SubjectField({
  value,
  editable,
  onChange,
}: {
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="ar-subject">Subject</Label>
      <Input
        id="ar-subject"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!editable}
        placeholder="e.g. Mathematics"
      />
    </div>
  );
}

function TermField({
  value,
  editable,
  onChange,
}: {
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="ar-term">Term</Label>
      <select
        id="ar-term"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!editable}
        className={selectClassName}
      >
        <option value="">—</option>
        {REPORT_CARD_TERMS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

function ScoreField({
  value,
  editable,
  onChange,
}: {
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="ar-score">Score or grade</Label>
      <Input
        id="ar-score"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!editable}
        placeholder="e.g. A, 92%, Meeting"
      />
    </div>
  );
}

function PerformanceField({
  value,
  editable,
  onChange,
}: {
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="ar-performance">Performance level</Label>
      <Input
        id="ar-performance"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!editable}
        placeholder="Optional descriptor"
      />
    </div>
  );
}

function CommentField({
  value,
  editable,
  onChange,
}: {
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="ar-comment">Teacher comment</Label>
      <Textarea
        id="ar-comment"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!editable}
        rows={4}
      />
    </div>
  );
}

function HabitsField({
  value,
  editable,
  onChange,
}: {
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="ar-habits">Work habits</Label>
      <Textarea
        id="ar-habits"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!editable}
        rows={3}
        placeholder="Optional"
      />
    </div>
  );
}
