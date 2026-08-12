"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  createCalendarNoteAction,
  updateCalendarNoteAction,
  type CalendarActionState,
} from "./calendar-actions";
import {
  CalendarRelatedFields,
  type CalendarRelatedSelection,
} from "./calendar-related-fields";
import type { CalendarNote } from "./types";

function relatedFromNote(note?: CalendarNote): CalendarRelatedSelection {
  if (note?.related.staffMemberId) {
    return {
      kind: "staff",
      id: note.related.staffMemberId,
      label: note.related.staffLabel,
    };
  }
  if (note?.related.studentId) {
    return {
      kind: "student",
      id: note.related.studentId,
      label: note.related.studentLabel,
    };
  }
  if (note?.related.classId) {
    return {
      kind: "class",
      id: note.related.classId,
      label: note.related.classLabel,
    };
  }
  return { kind: "none", id: null, label: null };
}

export function CalendarNoteForm({
  note,
  defaultDate,
  onSuccess,
}: {
  note?: CalendarNote;
  defaultDate: string;
  onSuccess?: () => void;
}) {
  const action = note ? updateCalendarNoteAction : createCalendarNoteAction;
  const [state, formAction, pending] = useActionState<
    CalendarActionState | undefined,
    FormData
  >(action, undefined);
  const handled = useRef(false);
  const noteId = useId();
  const [related, setRelated] = useState<CalendarRelatedSelection>(() =>
    relatedFromNote(note),
  );

  useEffect(() => {
    if (state?.ok && !handled.current) {
      handled.current = true;
      onSuccess?.();
    }
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {note ? <input type="hidden" name="noteId" value={note.id} /> : null}
      {related.kind === "staff" && related.id ? (
        <input type="hidden" name="staffMemberId" value={related.id} />
      ) : null}
      {related.kind === "student" && related.id ? (
        <input type="hidden" name="studentId" value={related.id} />
      ) : null}
      {related.kind === "class" && related.id ? (
        <input type="hidden" name="classId" value={related.id} />
      ) : null}

      <FormField id={noteId} label="Note" required>
        <Textarea
          id={noteId}
          name="note"
          required
          maxLength={2000}
          defaultValue={note?.note ?? ""}
          placeholder="Remember to confirm the gym setup."
          className="min-h-[100px]"
        />
      </FormField>

      <FormField id="note-date" label="Date" required>
        <Input
          id="note-date"
          name="noteDate"
          type="date"
          required
          defaultValue={note?.noteDate ?? defaultDate}
        />
      </FormField>

      <CalendarRelatedFields value={related} onChange={setRelated} disabled={pending} />

      {state && !state.ok ? (
        <p className="text-destructive text-sm" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : note ? "Save note" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
