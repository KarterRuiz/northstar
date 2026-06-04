"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  saveTransitionNoteDraft,
  submitTransitionNote,
} from "@/features/teacher/transition-notes/actions";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  transitionNoteSections,
  validateTransitionNoteForSubmit,
  type TransitionNoteFields,
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

export type TransitionNoteFormProps = {
  studentId: string;
  initialNoteId?: string;
  initialValues: TransitionNoteFields;
  editable: boolean;
  /** When the teacher can no longer edit (submitted / reviewed / archived). */
  lockedStatus?: string;
};

export function TransitionNoteForm({
  studentId,
  initialNoteId,
  initialValues,
  editable,
  lockedStatus,
}: TransitionNoteFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState<TransitionNoteFields>(initialValues);
  const [noteId, setNoteId] = React.useState<string | undefined>(initialNoteId);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleChange = (key: keyof TransitionNoteFields, next: string) => {
    setValues((prev) => ({ ...prev, [key]: next }));
    if (status.kind === "error" || status.kind === "draft-saved") {
      setStatus({ kind: "idle" });
    }
  };

  const handleSaveDraft = async () => {
    if (!editable) return;
    setIsSaving(true);
    setStatus({ kind: "idle" });
    try {
      const result = await saveTransitionNoteDraft(studentId, noteId, values);
      if (!result.ok) {
        setStatus({ kind: "error", message: result.message });
        return;
      }
      if (!noteId && result.noteId) {
        setNoteId(result.noteId);
        router.replace(
          `/dashboard/teacher/transition-notes/new?studentId=${encodeURIComponent(studentId)}&noteId=${encodeURIComponent(result.noteId)}`,
        );
      }
      setStatus({ kind: "draft-saved", at: Date.now() });
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editable) return;
    const result = validateTransitionNoteForSubmit(values);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.message });
      return;
    }

    setIsSubmitting(true);
    setStatus({ kind: "idle" });
    try {
      const submitResult = await submitTransitionNote(studentId, noteId, values);
      if (!submitResult.ok) {
        setStatus({ kind: "error", message: submitResult.message });
        return;
      }
      if (!noteId && submitResult.noteId) {
        setNoteId(submitResult.noteId);
        router.replace(
          `/dashboard/teacher/transition-notes/new?studentId=${encodeURIComponent(studentId)}&noteId=${encodeURIComponent(submitResult.noteId)}`,
        );
      }
      setStatus({ kind: "submitted" });
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      {!editable && lockedStatus ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="text-muted-foreground">This note is locked for editing.</span>
          <Badge variant="secondary" className="capitalize">
            {lockedStatus.replace(/_/g, " ")}
          </Badge>
        </div>
      ) : null}

      {status.kind !== "idle" ? (
        <div
          aria-live="polite"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            status.kind === "error"
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : status.kind === "submitted"
                ? "border-primary/25 bg-primary/5 text-foreground"
                : "border-border bg-muted/40 text-muted-foreground",
          )}
          role="status"
        >
          {status.kind === "draft-saved" ? (
            <span>
              Draft saved to Supabase
              <span className="text-muted-foreground">
                {" "}
                · {formatSavedAt(status.at)}
              </span>
            </span>
          ) : null}
          {status.kind === "submitted" ? (
            <span>Submitted. Leadership can review this note on the student profile.</span>
          ) : null}
          {status.kind === "error" ? <span>{status.message}</span> : null}
        </div>
      ) : null}

      {transitionNoteSections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {section.fields.map((field) => {
              const fieldId = `transition-note-${field.key}`;
              const helperId = `${fieldId}-helper`;
              return (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={fieldId}>{field.label}</Label>
                  <p className="text-muted-foreground text-sm" id={helperId}>
                    {field.helper}
                  </p>
                  <Textarea
                    id={fieldId}
                    name={field.key}
                    value={values[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    aria-describedby={helperId}
                    autoComplete="off"
                    readOnly={!editable}
                    className={!editable ? "bg-muted/50 text-muted-foreground" : undefined}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleSaveDraft}
            disabled={!editable || isSaving || isSubmitting}
          >
            {isSaving ? "Saving…" : "Save draft"}
          </Button>
          <Button type="submit" disabled={!editable || isSaving || isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
