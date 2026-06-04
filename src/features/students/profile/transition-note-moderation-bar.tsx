"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  archiveTransitionNoteAction,
  reopenTransitionNoteAction,
  reviewTransitionNoteAction,
  type SimpleActionResult,
} from "@/features/teacher/transition-notes/actions";

import type { TransitionNoteStatus } from "./types";

type TransitionNoteModerationBarProps = {
  studentId: string;
  noteId: string;
  status: TransitionNoteStatus;
};

export function TransitionNoteModerationBar({
  studentId,
  noteId,
  status,
}: TransitionNoteModerationBarProps) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);

  const wrap = (fn: () => Promise<SimpleActionResult>) => {
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const r = await fn();
        if (!r.ok) {
          setMessage(r.message);
        }
      })();
    });
  };

  return (
    <div className="border-border/80 mt-4 space-y-2 border-t pt-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Leadership
      </p>
      <div className="flex flex-wrap gap-2">
        {status === "submitted" ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              wrap(() => reviewTransitionNoteAction({ studentId, noteId }))
            }
          >
            Mark reviewed
          </Button>
        ) : null}
        {status === "submitted" ||
        status === "reviewed" ||
        status === "archived" ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              wrap(() => reopenTransitionNoteAction({ studentId, noteId }))
            }
          >
            Reopen for teacher
          </Button>
        ) : null}
        {status !== "archived" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              wrap(() => archiveTransitionNoteAction({ studentId, noteId }))
            }
          >
            Archive
          </Button>
        ) : null}
      </div>
      {message ? (
        <p className="text-destructive text-sm" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
