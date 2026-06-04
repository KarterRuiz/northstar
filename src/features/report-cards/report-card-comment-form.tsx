"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReportCardTerm } from "@/lib/report-cards/constants";

import {
  markReportCardCommentCompleteAction,
  saveReportCardCommentDraftAction,
} from "./report-card-comment-actions";
import type { ReportCardCommentRow } from "./types";

type ReportCardCommentFormProps = {
  studentId: string;
  classId: string;
  term: ReportCardTerm;
  initialComment: ReportCardCommentRow | null;
  readOnly?: boolean;
  compact?: boolean;
};

export function ReportCardCommentForm({
  studentId,
  classId,
  term,
  initialComment,
  readOnly = false,
  compact = false,
}: ReportCardCommentFormProps) {
  const [text, setText] = React.useState(initialComment?.narrativeComment ?? "");
  const [status, setStatus] = React.useState<"draft" | "complete">(
    initialComment?.status ?? "draft",
  );
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const disabled = readOnly || pending || status === "complete";

  function runAction(
    mode: "draft" | "complete",
    action: (fd: FormData) => Promise<{ ok: boolean; message?: string }>,
  ) {
    setMessage(null);
    const fd = new FormData();
    fd.set("studentId", studentId);
    fd.set("classId", classId);
    fd.set("term", term);
    fd.set("narrativeComment", text);
    startTransition(async () => {
      const result = await action(fd);
      if (!result.ok) {
        setMessage(result.message ?? "Could not save.");
        return;
      }
      setStatus(mode === "complete" ? "complete" : "draft");
      setMessage("Saved.");
    });
  }

  return (
    <form
      className={compact ? "space-y-2" : "space-y-3"}
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`comment-${studentId}`} className="text-xs">
          Narrative comment
          {status === "complete" ? (
            <span className="text-muted-foreground ml-2 font-normal">(complete)</span>
          ) : null}
        </Label>
        <Textarea
          id={`comment-${studentId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          rows={compact ? 3 : 5}
          placeholder="Strengths, growth areas, and term highlights…"
          className="text-sm"
        />
      </div>
      {!readOnly && status !== "complete" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              runAction("draft", saveReportCardCommentDraftAction)
            }
          >
            Save draft
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || !text.trim()}
            onClick={() =>
              runAction("complete", markReportCardCommentCompleteAction)
            }
          >
            Mark complete
          </Button>
        </div>
      ) : null}
      {message ? (
        <p
          className={
            message === "Saved."
              ? "text-muted-foreground text-xs"
              : "text-destructive text-xs"
          }
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
